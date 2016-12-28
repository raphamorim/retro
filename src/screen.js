import retro from './retro'

import Notify from 'fs.notify'
import { remote as app } from 'electron'
import { tabs, modalSearch, modalItems, modal } from './selectors'
import loader from './lib/loader'

export const notifications = new Notify();

notifications.on('change', (file, event, path) => {
	if (event === 'change') {
		retro.updateFile(path)
	}
})

export function openFiles() {
	app.dialog.showOpenDialog((fileNames) => {
		if (fileNames && fileNames.length) {
			loader.on();
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