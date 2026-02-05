let myWindowId;
const list=document.querySelector("#content");

function updateContent() {
    browser.tabGroups.query({windowId: myWindowId})
	.then((tabGroups) => {
	    console.log(tabGroups)
	    tabGroups.forEach(tabGroups => {
		const li = document.createElement("li");
		li.textContent = tabGroups.title;
		list.appendChild(li);
	    });
	});
}

browser.tabs.onActivated.addListener(updateContent);

browser.windows.getCurrent({populate: true}).then((windowInfo) => {
  myWindowId = windowInfo.id;
  updateContent();
});
