let myWindowId;
const list=document.querySelector("#content");

function updateContent() {
    list.innerHTML = "";
    browser.tabGroups.query({windowId: myWindowId})
	.then((tabGroups) => {
	    tabGroups.forEach(tabGroup => {
		const li = document.createElement("li");
		const button = document.createElement("button");
		button.textContent=tabGroup.title;
		li.appendChild(button);
		list.appendChild(li);

		button.addEventListener("click", () => {
		    browser.runtime.sendMessage({
			type: "SWITCH_TO_GROUP",
			payload: {
			    groupId: tabGroup.id
			}
		    });
		});
	    });
	});
}

browser.tabs.onActivated.addListener(updateContent);

browser.windows.getCurrent({populate: true}).then((windowInfo) => {
  myWindowId = windowInfo.id;
  updateContent();
});
