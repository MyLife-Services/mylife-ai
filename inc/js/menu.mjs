class Menu {
	#menu
	constructor(Avatar){
		this.#setMenu()
	}
	get menu(){
		return this.#menu
	}
	#setMenu(){
		this.#menu = [
			{ display: `About`, icon: 'about', memberClick: 'about()', memberRoute: 'javascript:void(0)', route: '/about', },
			{ display: `Walkthrough`, route: 'https://medium.com/@ewbj/mylife-we-save-your-life-480a80956a24', icon: 'gear', },
			{ display: `Donate`, route: 'https://gofund.me/65013d6e', icon: 'donate', },
		]
	}
}
//	exports
export default Menu