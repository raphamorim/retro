import retro from './retro'

import Notify from 'fs.notify'
import { remote as app } from 'electron'
import { tabs, modalSearch, modalItems, modal } from './selectors'

const notifications = new Notify();

// notifications.close to end all
notifications.on('change', (file, event, path) => {
	if (event === 'change')
		retro.updateFile(path);
})

export function openFiles() {
	app.dialog.showOpenDialog((fileNames) => {
		if (fileNames && fileNames.length) {
			retro.openFile(fileNames[0]);
			notifications.add(fileNames[0]);
		}
	});
}

export function unfocusTabs() {
	tabs.classList.add('unfocus');
}

export function toggleTabs() {
	tabs.classList.toggle('unfocus');
}

export function toggleModal() {
	modal.classList.toggle('visible');
	if (modal.classList.contains('visible')) {
		setTimeout(() => {
			modalSearch.focus()
		}, 30);
	}
}