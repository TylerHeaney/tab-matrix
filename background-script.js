console.log("Init")

/*
 * Switches to the first tab in the group with id payload.groupId
 * Collapses all groups and uncollapses active group
 */
async function switchToGroup(payload) {
    const tabs = await browser.tabs.query({ groupId: payload.groupId });
    if (tabs.length > 0) {
	const newTab = tabs[0];
	await browser.tabs.update(newTab.id, { active: true });
	const groups = await browser.tabGroups.query({ windowId: newTab.windowId });
	await Promise.all(groups.map(group => browser.tabGroups.update(group.id, {collapsed: group.id !== newTab.groupId  })));
	// let activeGroups = await browser.storage.session.get("activeGroups");
	// console.log("group get",await browser.storage.session.get())
	// if (Object.keys(activeGroups).length === 0) {
	//     activeGroups.activeGroups = {};
	// }
	// activeGroups.activeGroups[newTab.windowId]=newTab.groupId;
	// await browser.storage.session.set(activeGroups)
	// console.log("group set",await browser.storage.session.get());
    }
}

/*
 * Creates a "Default" group in each window where "needsGrouping" is true
 * and adds all ungrouped tabs to that group
 * returns id of newly created group
 */
async function addUngroupedTabsToDefaultGroup(windows) {
    console.log("add... func called");
    for (const win of windows) {
	console.log("window actually needs grouping");
	const ungroupedTabs = win.tabs.filter(tab => tab.groupId === browser.tabGroups.TAB_GROUP_ID_NONE);
	console.log(win.tabs);
	if (ungroupedTabs.length > 0) {
	    const defaultId = await browser.tabs.group({ tabIds: ungroupedTabs.map(tab => tab.id), createProperties: { windowId: ungroupedTabs[0].windowId }});
	    await browser.tabGroups.update(defaultId, {title: "Default", color: "grey" });
	    return defaultId
	}
    }
    return browser.tabGroups.TAB_GROUP_ID_NONE;
}

/*
 * waits for window to finish attaching tabs before returning said list
 */
async function waitForTabs(windowId,timeout=1000) {
    const start = Date.now();
  while (Date.now() - start < timeout) {
    const tabs = await browser.tabs.query({ windowId });
    if (tabs.length > 0) return tabs;
    // Wait a bit before retrying
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return [];
}

// runs addUngroupedTabsToDefaultGroup on every window when extension is installed
browser.runtime.onInstalled.addListener(async () => {
    const windows = await browser.windows.getAll({populate: true});
    await addUngroupedTabsToDefaultGroup(windows);
    const tabs = await browser.tabs.query({ active: true });
    let activeGroups = await browser.storage.session.get("activeGroups");
    if (Object.keys(activeGroups).length === 0) {
	activeGroups.activeGroups = {};
    }
    tabs.forEach((tab) => { activeGroups.activeGroups[tab.windowId]=tab.groupId });
    await browser.storage.session.set(activeGroups);
});
// when tabs are moved to a new window, add them to a default group
browser.tabs.onAttached.addListener(async (tabid,attachinfo) => {
    await Promise.resolve();
    const tabs = await waitForTabs(attachinfo.newWindowId);
    const win = await browser.windows.get(attachinfo.newWindowId,{populate: true});
    let activeGroups = await browser.storage.session.get("activeGroups");
    if (Object.keys(activeGroups).length === 0) {
	activeGroups.activeGroups = {};
	const defaultId=addUngroupedTabsToDefaultGroup([win]);
	activeGroups.activeGroups[info.windowId]=defaultId;
	await browser.storage.session.set(activeGroups);
    } else {
	console.log(tabid,attachinfo,tabs,win,activeGroups.activeGroups);
	console.log({ groupId: activeGroups.activeGroups[attachinfo.newWindowId], tabIds: tabid });
	await browser.tabs.group({ groupId: activeGroups.activeGroups[attachinfo.newWindowId], tabIds: tabid });
    }
});

browser.tabs.onCreated.addListener(async (tab) => {
    // first, check if there are any groups
    const groups = await browser.tabGroups.query({ windowId: tab.windowId });
    if (groups.length === 0) { // newly created window
	const defaultId = await browser.tabs.group({ tabIds: [tab.id], createProperties: { windowId: tab.windowId }});
	await browser.tabGroups.update(defaultId, {title: "Default", color: "grey" });
	let activeGroups = await browser.storage.session.get("activeGroups");
	if (Object.keys(activeGroups).length === 0) {
	    activeGroups.activeGroups = {};
	}
	activeGroups.activeGroups[tab.windowId]=defaultId
	await browser.storage.session.set(activeGroups);
    } else {
	let activeGroups = await browser.storage.session.get("activeGroups");
	await browser.tabs.group({ groupId: activeGroups.activeGroups[tab.windowId], tabIds: tab.id });
    }
});

browser.tabs.onActivated.addListener(async (info) => {
    const tab = await browser.tabs.get(info.tabId);
    if (tab.groupId === browser.tabGroups.TAB_GROUP_ID_NONE) {
	return
    }
    if (info.previousTabId) { // activation caused by switch
	const oldTab = await browser.tabs.get(info.previousTabId);
	if (tab.groupId !== oldTab.groupId) {
	    // switchToGroup({ groupId: tab.groupId });
	    let activeGroups = await browser.storage.session.get("activeGroups");
	    if (Object.keys(activeGroups).length === 0) {
		activeGroups.activeGroups = {};
	    }
	    activeGroups.activeGroups[info.windowId]=tab.groupId;
	    await browser.storage.session.set(activeGroups);
	    const groups = await browser.tabGroups.query({ windowId: tab.windowId });
	    await Promise.all(groups.map(group => browser.tabGroups.update(group.id, {collapsed: group.id !== tab.groupId  })));
	}
    } else { // activation caused by closed tab
	let activeGroups = await browser.storage.session.get("activeGroups");
	if (Object.keys(activeGroups).length === 0) {
	    activeGroups.activeGroups = {};
	}
	activeGroups.activeGroups[info.windowId]=tab.groupId;
	await browser.storage.session.set(activeGroups);
	const groups = await browser.tabGroups.query({ windowId: tab.windowId });
	await Promise.all(groups.map(group => browser.tabGroups.update(group.id, {collapsed: group.id !== tab.groupId  })));
    }
});

browser.tabs.onMoved.addListener(async (tabId,info) => {
    const tab = await browser.tabs.get(tabId)
    if (tab.active) {
	let activeGroups = await browser.storage.session.get("activeGroups");
	if (Object.keys(activeGroups).length === 0) {
	    activeGroups.activeGroups = {};
	}
	activeGroups.activeGroups[tab.windowId]=tab.groupId;
	await browser.storage.session.set(activeGroups);
	const groups = await browser.tabGroups.query({ windowId: tab.windowId });
	await Promise.all(groups.map(group => browser.tabGroups.update(group.id, {collapsed: group.id !== tab.groupId  })));
    }
});

browser.runtime.onMessage.addListener(async (message, sender) => {
    switch (message.type) {
    case "SWITCH_TO_GROUP":
	await switchToGroup(message.payload);
	break;
    default:
	console.warn("Unknown message:", message);
    }
});

