console.log("Init")

async function switchToGroup(payload) {
    console.log("test")
    const tabs = await browser.tabs.query({ groupId: payload.groupId });
    if (tabs.length > 0) {
	const newTab = tabs[0];
	await browser.tabs.update(newTab.id, { active: true });
	const groups = await browser.tabGroups.query({ windowId: newTab.windowId });
	await Promise.all(groups.map(group => browser.tabGroups.update(group.id, {collapsed: group.id !== newTab.groupId  })));
    }
    
}

browser.runtime.onMessage.addListener(async (message, sender) => {
    switch (message.type) {
    case "SWITCH_TO_GROUP":
	await switchToGroup(message.payload);
	break;
    default:
	console.warn("Unknown message:", message);
    }
});
