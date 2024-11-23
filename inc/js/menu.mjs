class Menu {
	#menu
	constructor(Avatar){
		this.#setMenu()
	}
	get menu(){
		return this.#menu
	}
	#setMenu(){
		/* **note**: clicks need connector between window element and datamanager call, even when genericized with an intermediary */
		this.#menu = [
			{ display: `About`, icon: 'about', click: 'about()', route: 'javascript:void(0)', },
			{ display: `Walkthrough`, route: 'https://medium.com/@ewbj/mylife-we-save-your-life-480a80956a24', icon: 'gear', },
			{ display: `Donate`, route: 'https://gofund.me/65013d6e', icon: 'donate', },
		]
	}
}
//	exports
export default Menu