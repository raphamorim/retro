import { openFiles, toggleModal, toggleTabs } from './screen'

function Keys() {
	function init() {
		key('⌘+o', function(event, handler) {
			// TODO: Multiple files and diretory
			openFiles()
		})

		key('⌘+p', function(event, handler) {
			toggleModal()
		})

		key('⌘+e', function(event, handler) {
			toggleTabs()
		})

		key('⌘+,', function(event, handler) {
			// TODO: Preferences
			console.log('Preferences')
		})
	}

	this.init = init
}

export default new Keys()
