let myWindowId;
let list=document.querySelector("#content");

function updateContent() {
    console.log("updateC");
    browser.tabGroups.query({windowId: myWindowId})
	.then((tabGroups) => {
	    let newList=document.createElement("ul");
	    tabGroups.forEach(tabGroup => {
		const li = document.createElement("li");
		const button = document.createElement("button");
		button.textContent=tabGroup.title;
		li.appendChild(button);
		newList.appendChild(li);

		button.addEventListener("click", () => {
		    browser.runtime.sendMessage({
			type: "SWITCH_TO_GROUP",
			payload: {
			    groupId: tabGroup.id
			}
		    });
		});
	    });
	    list.replaceChildren(...newList.childNodes);
	});
}

browser.tabGroups.onCreated.addListener(updateContent);
browser.tabGroups.onRemoved.addListener(updateContent);
browser.tabGroups.onUpdated.addListener(updateContent);
browser.tabGroups.onMoved.addListener(updateContent);
browser.windows.getCurrent({populate: true}).then((windowInfo) => {
  myWindowId = windowInfo.id;
  updateContent();
});
