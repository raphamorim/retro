const load = document.querySelector('.loader');

class Loader {
	on() {
		load.classList.add('on');	
	}

	off() {
		load.classList.remove('on');		
	}
}

export default new Loader();