class Menu {
	#menu
	constructor(_Agent){
		this.#menu = this.#setMenu(_Agent)
	}
	get menu(){
		return this.#menu
	}
	#setMenu(_Agent){
		return [
			{ display: `about`, route: '/about', icon: 'about', },
			{ display: `walkthrough`, route: 'https://medium.com/@ewbj/mylife-we-save-your-life-480a80956a24', icon: 'gear', },
			{ display: `donate`, route: 'https://gofund.me/65013d6e', icon: 'donate', },
		]
	}
}
//	exports
export default Menu