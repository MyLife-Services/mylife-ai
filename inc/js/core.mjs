//	imports
import EventEmitter from 'events'
//	server-specific imports
import initRouter from './routes.mjs'
//	define export Classes for Members and MyLife
class Member extends EventEmitter {
	#avatar
	#factory
	constructor(factory){
		super()
		this.#factory = factory
	}
	/**
	 * Initializes `this.#avatar` and returns `this`. The Avatar will thence be primary point of interaction with Session and Server. Only upon dissolution of Avatar [sessionEnd] is triggered an internal `this` evolution evaluation based on upon the conduct of Avatar.
	 * @async
	 * @public
	 * @param {Q} avatar - Avatar object to initialize, when infused from child instance
	 * @returns {Promise} Promise resolves to this Member class instantiation
	 */
	async init(avatar){
		this.#avatar = avatar
			?? await this.factory.getAvatar()
		return this
	}
	//	getter/setter functions
	get abilities(){
		return this.core.abilities
	}
	get agent(){
		return this.#avatar
	}
	get agentCategories(){
		return this.agent.categories
	}
	get agentCommand(){
		return this.agent.command_word
	}
	get agentDescription(){	//	agent description (not required)
		if(!this.agent?.description)
			this.avatar.description = `I am ${ this.agentName }, AI-Agent for ${ this.name }`
		return this.agent.description
	}
	get agentName(){
		return this.avatar.names[0]
	}
	get agentProxy(){
		switch(this.form){	//	need switch because I could not overload class function
			case 'organization':
				return this.description
			default:
				return this.bio
		}
	}
	get avatar(){
		return this.#avatar
	}
	set avatar(_Avatar){
		//	oops, hack around how to get dna of avatar class; review options [could block at factory-getter level, most efficient and logical]
		if(!this.factory.isAvatar(_Avatar))
			throw new Error('avatar requires Avatar Class')
		this.#avatar = _Avatar
	}
	/**
	 * Gets being type. Members are _only_ human prototypes, and presents as human, even though the current manifestation is a datacore `core` being.
	 * @returns {string} returns 'human'
	*/
	get being(){
		return 'human'
	}
	get beliefs(){
		return this.core.beliefs
	}
	get bio(){
		return this.core.bio
	}
	get categories(){
		return this.agent.categories
	}
	get chat(){
		return this.agent.chat
	}
	get consent(){
		return this.factory.consent	//	**caution**: returns <<PROMISE>>
	}
	set consent(_consent){
		this.factory.consents.unshift(_consent.id)
	}
	get core(){
		return this.factory.core
	}
	get dataservice(){
		return this.dataservices
	}
	get dataservices(){
		return this.factory.dataservices
	}
	get description(){
		return this.core.description
	}
	get email(){
		return this.core.email
	}
	get factory(){
		return this.#factory
	}
	get facts(){
		return this.core.facts
	}
	get form(){
		return this.core.form
	}
	get globals(){
		return this.factory.globals
	}
	get hobbies(){
		return this.core.hobbies
	}
	get interests(){
		return this.core.interests
	}
	get id(){
		return this.sysid
	}
	get mbr_id(){
		return this.factory.mbr_id
	}
	get member(){
		return this.core
	}
	get memberName(){
		return this.core.names[0]
	}
	get name(){
		return this.core.name
	}
	get newGuid(){
		return this.globals.newGuid
	}
	get preferences(){
		return this.core.preferences
	}
	get skills(){
		return this.core.skills
	}
	get sysname(){
		return this.mbr_id.split('|')[0]
	}	
	get sysid(){
		return this.mbr_id.split('|')[1]
	}
	get values(){
		return this.core.values
	}
	//	public functions
	async testEmitters(){
		//	test emitters with callbacks
		this.emit('testEmitter',_response=>{
			console.log('callback emitters enabled:',_response)
		})
	}
}
class Organization extends Member {	//	form=organization
	#Menu
	#Router
	constructor(_Factory){
		super(_Factory)
	}
	/* public functions */
	async init(avatar){
		if(!avatar)
			throw new Error('avatar parameter currently required for Organization imprint')
		return await super.init(avatar)
	}
	/* getters/setters */
	/**
	 * Gets being type. MyLife are _only_ MyLife prototypes, and presents as mylife, even though the current manifestation is a datacore `core` being.
	 * @returns {string} returns 'MyLife'
	*/
	get being(){
		return 'MyLife'
	}
	get description(){
		return this.core.description
	}
	get governance(){
		return this.core.governance
	}
	get membership(){
		return this.core.membership
	}
	get menu(){
		if(!this.#Menu){
			this.#Menu = new (this.factory.schemas.menu)(this).menu
		}
		return this.#Menu
	}
	get mission(){
		return this.core.mission
	}
	get name(){
		return this.core.names[0]
	}
	get philosophy(){
		return this.core.philosophy
	}
	get privacy(){
		return this.core.privacy
	}
	get roadmap(){
		return this.core.roadmap
	}
	get router(){
		if(!this.#Router){
			this.#Router = initRouter(new (this.factory.schemas.menu)(this))
		}
		return this.#Router
	}
	get security(){
		return this.core.security
	}
	get services(){
		return this.core.services
	}
	get values(){
		return this.core.values
	}
	get vision(){
		return this.core.vision
	}
}
class MyLife extends Organization {	// form=server
	#avatar // MyLife's private class avatar, _same_ object reference as Member Class's `#avatar`
	#version = '0.0.0' // indicates error
	constructor(factory){ // no session presumed to exist
		super(factory)
	}
	async init(){
		this.#avatar = await this.factory.getAvatar()
		return await super.init(this.#avatar)
	}
	/**
	 * Retrieves all public experiences (i.e., owned by MyLife).
	 * @returns {Object[]} - An array of the currently available public experiences.
	 */
	async availableExperiences(){
		const experiences = ( await this.factory.availableExperiences() )
			.map(experience=>{ // map to display versions [from `mylife-avatar.mjs`]
				const { autoplay=false, description, id, name, purpose, skippable=true,  } = experience
				return {
					description,
					id,
					name,
					purpose,
				}
			})
		return experiences
	}
	async datacore(_mbr_id){
		if(!_mbr_id || _mbr_id===this.mbr_id) throw new Error('datacore cannot be accessed')
		return await this.factory.datacore(_mbr_id)
	}
	/* public functions */
	/**
	 * Server MyLife _Maht instantiation uses this function to populate the most current alerts in the modular factory memoryspace. Currently only applicable to system types, but since this is implemented at the `core.mjs` scope, we can account
	 * @public
	 * @returns {void} returns nothing, performs operation
	 */
	getAlerts(){
		this.factory.getAlerts()
	}
	async getMyLifeSession(){
		return await this.factory.getMyLifeSession()
	}
	/**
	 * Returns Array of hosted members based on validation requirements.
	 * @param {Array} validations - Array of validation strings to filter membership.
	 * @returns {Promise<Array>} - Array of string ids, one for each hosted member.
	 */
	async hostedMembers(validations){
		return await this.factory.hostedMembers(validations)
	}
	/**
	 * Registers a new candidate to MyLife membership
	 * @public
	 * @param {object} candidate { 'avatarName': string, 'email': string, 'humanName': string, }
	 */
	async registerCandidate(candidate){
		return await this.factory.registerCandidate(candidate)
	}
	/**
	 * Submits a story to MyLife via API. Unclear if can be dual-purposed for internal, or if internal still instantiates API context.
	 * @public
	 * @param {string} _mbr_id - Member id
	 * @param {string} _assistantType - String name of assistant type
	 * @param {string} _summary - String summary of story
	 * @returns {object} - The story document from Cosmos.
	 */
	async story(_mbr_id, _assistantType, storySummary){
		const id = this.globals.newGuid
		const _story = {
			assistantType: _assistantType,
			being: 'story',
			form: _assistantType,
			id,
			mbr_id: _mbr_id,
			name: `story_${_assistantType}_${_mbr_id}`,
			summary: storySummary,
		}
		const _storyCosmos = await this.factory.story(_story)
		return this.globals.stripCosmosFields(_storyCosmos)
	}
	/**
	 * Tests partition key for member
	 * @public
	 * @param {string} _mbr_id member id
	 * @returns {boolean} returns true if partition key is valid
	 */
	async testPartitionKey(_mbr_id){
		return await this.factory.testPartitionKey(_mbr_id)
	}
	/* getters/setters */
	/**
	 * Gets MyLife agent role, refers to server entity Maht/MyLife
	 * @returns {object} returns { role: 'system', content: 'I am <||Q||>, AI-Agent for the nonprofit member organization MyLife' }
	*/
	get agentRole(){
		switch(this.being){
			default:	//	core
				const replacedDescription = 'I am <||Q||>, AI-Agent for the nonprofit member organization MyLife'
				return {
						role: "system",
						content: replacedDescription
					}					
		}
	}
	/**
	 * Gets being type. MyLife are _only_ MyLife prototypes, and presents as mylife, even though the current manifestation is a datacore `core` being.
	 * @returns {string} returns 'MyLife'
	*/
	get being(){
		return 'MyLife'
	}
	get version(){
		return this.#version
	}
	set version(_version){
		if(!this.globals.isValidVersion(_version))
			throw new Error('Invalid version number')
		this.#version = _version
	}
}
/* exports */
export {
	Member,
	Organization,
	MyLife,
}