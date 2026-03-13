console.log("Init")


async function hideGroup(group) {
    browser.tabGroups.update(group.id, {collapsed: true, title: ''});
    const otherGroupTabs = (await browser.tabs.query({groupId: group.id})).map(tab=>tab.id);
    browser.tabs.hide(otherGroupTabs);
}

async function showGroup(group,data) {
    const tabs = await browser.tabs.query({ groupId: group.id });
    if (tabs.length > 0) {
	const newTab = tabs[0];
	browser.tabs.show(tabs.map(tab=>tab.id));
	// await browser.tabs.update(newTab.id, { active: true });
	await browser.tabGroups.update(group.id, {collapsed: false, title: data.title});
    }
}

/*
 * Switches to the first tab in the group with id payload.groupId
 * Collapses all groups and uncollapses active group
 */
async function switchToGroup(payload) {
    const groups = await browser.tabGroups.query({ windowId: payload.windowId });
    let groupData = (await browser.storage.local.get("groupData")).groupData;
    groupData[payload.windowId]=groupData[payload.windowId].map(group => {
	return {
	    title: group.title,
	    id: group.id,
	    active: group.id==payload.groupId
	}
    });
    browser.storage.local.set({groupData: groupData});
    await Promise.all(groups.map(group => {
	if (group.id==payload.groupId) {
	    showGroup(group,groupData[payload.windowId].find(data => data.id==group.id));
	} else {
	    hideGroup(group,groupData[payload.windowId].find(data => data.id==group.id));
	}
    }))
}

/*
 * Creates a "Default" group in each window where "needsGrouping" is true
 * and adds all ungrouped tabs to that group
 * returns id of newly created group
 */
async function addUngroupedTabsToDefaultGroup(windows, isActive) {
    for (const win of windows) {
	const ungroupedTabs = win.tabs.filter(tab => tab.groupId === browser.tabGroups.TAB_GROUP_ID_NONE);
	if (ungroupedTabs.length > 0) {
	    const defaultId = await browser.tabs.group({ tabIds: ungroupedTabs.map(tab => tab.id), createProperties: { windowId: ungroupedTabs[0].windowId }});
	    await browser.tabGroups.update(defaultId, {title: "Default", color: "grey" });
	    let groupData= (await browser.storage.local.get("groupData")).groupData
	    groupData[win.id].push({title: "Default", active: isActive, id: defaultId});
	    await browser.storage.local.set({groupData: groupData});
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
    await addUngroupedTabsToDefaultGroup(windows,false);
    const tabs = await browser.tabs.query({ active: true });
    const activeGroupIds = tabs.map(tab=>tab.groupId);

    // set up active Group info storage
    let groupData = {}
    const groups = await browser.tabGroups.query({});
    windows.forEach(async (window) => {
	groupData[window.id]=groups.filter(group=>group.windowId==window.id).map(group => {
	    return { title: group.title,
		     active: activeGroupIds.some(id => id==group.id),
		     id: group.id
		   }
	});
	await switchToGroup({groupId:groupData[window.id].find(group=>group.active).id,windowId:window.id});
    });
    browser.storage.local.set({groupData: groupData})
});
// when tabs are moved to a new window, add them to a default group
browser.tabs.onAttached.addListener(async (tabid,attachinfo) => {
    const tabs = await waitForTabs(attachinfo.newWindowId);
    const win = await browser.windows.get(attachinfo.newWindowId,{populate: true});
    let groupData = (await browser.storage.local.get("groupData")).groupData;
    const groups = await browser.tabGroups.query({windowId: attachinfo.newWindowId});
    if (groups.length===0) {
	const defaultId=addUngroupedTabsToDefaultGroup([win],true);
    } else {
	let winGroupData = groupData[win.id].find(data=>data.active)
	await browser.tabs.group({groupId: winGroupData.id, tabIds: tabid});
    }
});

browser.tabs.onCreated.addListener(async (tab) => {
    // first, check if there are any groups
    const groups = await browser.tabGroups.query({ windowId: tab.windowId });
    if (groups.length === 0) { // newly created window
	const defaultId = await browser.tabs.group({ tabIds: [tab.id], createProperties: { windowId: tab.windowId }});
	await browser.tabGroups.update(defaultId, {title: "Default", color: "grey" });
	let groupData = (await browser.storage.local.get("groupData")).groupData;
	groupData[tab.windowId].push({title: "Default", active: true, id: defaultId});
	await browser.storage.local.set({groupData: groupData});
    } else {
	let groupData = (await browser.storage.local.get("groupData")).groupData;
	let activeGroup = groupData[tab.windowId].find(group => group.active)
	await browser.tabs.group({ groupId: activeGroup.id, tabIds: tab.id });
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
	    switchToGroup({ groupId: tab.groupId, windowId: tab.windowId });
	    // let groupData = await browser.storage.local.get("groupData");
	    // groupData=groupData.map(group => {
	    // 	if (group.windowId==tab.windowId) {
	    // 	    return {
	    // 		title: group.title,
	    // 		id: group.id
	    // 		active: group.id == tab.groupId
	    // 	    }
	    // 	} else {
	    // 	    return {
	    // 		title: group.title,
	    // 		id: group.id
	    // 		windowId: group.windowId
	    // 		active: group.active
	    // 	    }
	    // 	}
	    // });
	    // await browser.storage.local.set({groupData: groupData});
	    // const groups = await browser.tabGroups.query({ windowId: tab.windowId });
	    // await Promise.all(groups.map(group => browser.tabGroups.update(group.id, {collapsed: group.id !== tab.groupId  })));
	}
    } else { // activation caused by closed tab
	await switchToGroup({groupId: tab.groupId, windowId: tab.windowId});
	await browser.tabs.update(tab.id,{active: true});
	// let groupData = await browser.storage.local.get("groupData");
	// activeGroups.activeGroups[info.windowId]=tab.groupId;
	// await browser.storage.session.set(activeGroups);
	// const groups = await browser.tabGroups.query({ windowId: tab.windowId });
	// await Promise.all(groups.map(group => browser.tabGroups.update(group.id, {collapsed: group.id !== tab.groupId  })));
    }
});

browser.tabs.onMoved.addListener(async (tabId,info) => {
    const tab = await browser.tabs.get(tabId)
    if (tab.active) {
	await switchToGroup({groupId: tab.groupId, windowId: tab.windowId})
	await browser.tabs.update(tabId,{active:true});
    }
});

browser.runtime.onMessage.addListener(async (message, sender) => {
    switch (message.type) {
    case "SWITCH_TO_GROUP":
	const tabs = await browser.tabs.query({groupId: message.payload.groupId})
	console.assert(tabs.length>0)
	await browser.tabs.update(tabs[0].id,{active: true})
	break;
    default:
	console.warn("Unknown message:", message);
    }
});
