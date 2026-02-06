console.log("Init")

/*
 * Switches to the first tab in the group with id payload.groupId
 * Collapses all groups and uncollapses active group
 */
async function switchToGroup(payload) {
    console.log("test")
    const tabs = await browser.tabs.query({ groupId: payload.groupId });
    if (tabs.length > 0) {
	const newTab = tabs[0];
	await browser.tabs.update(newTab.id, { active: true });
	const groups = await browser.tabGroups.query({ windowId: newTab.windowId });
	await Promise.all(groups.map(group => browser.tabGroups.update(group.id, {collapsed: group.id !== newTab.groupId  })));
	let activeGroups = await browser.storage.session.get("activeGroups");
	if (Object.keys(activeGroups).length === 0) {
	    activeGroups.activeGroups = {};
	}
	activeGroups.activeGroups[newTab.windowId]=newTab.groupId;
	await browser.storage.session.set(activeGroups)
    }
}

/*
 * Creates a "Default" group in each window where "needsGrouping" is true
 * and adds all ungrouped tabs to that group
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
	}
    }
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
});
// when tabs are moved to a new window, add them to a default group
browser.tabs.onAttached.addListener(async (tabid,attachinfo) => {
    await Promise.resolve();
    const tabs = await waitForTabs(attachinfo.newWindowId);
    const win = await browser.windows.get(attachinfo.newWindowId,{populate: true});
    await addUngroupedTabsToDefaultGroup([win]);
});


// browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
//     console.log("activation start")
//     mruTabs = await browser.storage.session.get({"mruTabs": []});
//     Promise.resolve().then(() => {
// 	browser.sessions.getWindowValue(windowId,"mruTabs").then((mruTabs) => {
// 	    if (mruTabs === undefined) {mruTabs=[]}
// 	    mruTabs = mruTabs.filter(id => id !== tabId);
// 	    mruTabs.unshift(tabId);
// 	    console.log(mruTabs);
// 	    browser.sessions.setWindowValue(windowId,"mruTabs",mruTabs);
// 	});
//     });
	
// });

// browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
//     console.log(tabId)
//     if (removeInfo.isWindowClosing) { return }
//     Promise.resolve().then(() => {
// 	browser.sessions.getWindowValue(removeInfo.windowId,"mruTabs").then((mruTabs) => {
// 	    if (mruTabs === undefined) {mruTabs=[]}
// 	    mruTabs = mruTabs.filter(id => id !== tabId);
// 	    console.log(mruTabs);
// 	    browser.sessions.setWindowValue(removeInfo.windowId,"mruTabs",mruTabs);
// 	});
//     });
// });

// Get the last active tab (similar to Firefox Ctrl+Tab MRU)
// function getPreviousTab() {
    // return mruTabs.length > 1 ? mruTabs[1] : null;
// }


browser.tabs.onCreated.addListener(async (tab) => {
    // first, check if there are any groups
    const groups = await browser.tabGroups.query({ windowId: tab.windowId });
    if (groups.length === 0) {
	const defaultId = await browser.tabs.group({ tabIds: [tab.id], createProperties: { windowId: tab.windowId }});
	await browser.tabGroups.update(defaultId, {title: "Default", color: "grey" });
    } else {
	const activeGroups = await browser.storage.session.get("activeGroups");
	await browser.tabs.group({ groupId: activeGroups.activeGroups[tab.windowId], tabIds: tab.id });
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

