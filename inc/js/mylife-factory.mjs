/* imports */
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import util from 'util'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
import { Avatar, Q, } from './mylife-avatar.mjs'
import Dataservices from './mylife-dataservices.mjs'
import { Member, MyLife } from './core.mjs'
import {
	extendClass_consent,
    extendClass_conversation,
	extendClass_experience,
    extendClass_file,
	extendClass_message,
} from './factory-class-extenders/class-extenders.mjs'	//	do not remove, although they are not directly referenced, they are called by eval in mConfigureSchemaPrototypes()
import LLMServices from './mylife-llm-services.mjs'
import Menu from './menu.mjs'
import MylifeMemberSession from './session.mjs'
import chalk from 'chalk'
/* module constants */
const { MYLIFE_SERVER_MBR_ID: mPartitionId, } = process.env
const mDataservices = await new Dataservices(mPartitionId).init()
const mBotInstructions = {}
const mDefaultBotType = 'personal-avatar'
const mExtensionFunctions = {
	extendClass_consent: extendClass_consent,
	extendClass_conversation: extendClass_conversation,
	extendClass_experience: extendClass_experience,
	extendClass_file: extendClass_file,
	extendClass_message: extendClass_message,
}
const mExcludeProperties = {
	$schema: true,
	$id: true,
	$defs: true,
	$comment: true,
	definitions: true,
	name: true
}
const mGeneralBotId = 'asst_yhX5mohHmZTXNIH55FX2BR1m'
const mLLMServices = new LLMServices()
const mNewGuid = ()=>Guid.newGuid().toString()
const mPath = './inc/json-schemas'
const mReservedJSCharacters = [' ', '-', '!', '@', '#', '%', '^', '&', '*', '(', ')', '+', '=', '{', '}', '[', ']', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.', '?', '/', '~', '`']
const mReservedJSWords = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'enum', 'await', 'implements', 'package', 'protected', 'interface', 'private', 'public', 'null', 'true', 'false', 'let', 'static']
const mShadows = [
	{
		being: 'shadow',
		categories: ['personal', 'location'],
		form: 'story',
		id: '0087b3ec-956e-436a-9272-eceed5e97ad0',
		name: 'shadow_0087b3ec-956e-436a-9272-eceed5e97ad0',
		proxy: '/shadow',
		text: `At the time, I was living at...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['relations',],
		form: 'story',
		id: '0aac1ca3-a9d2-4587-ad9f-3e85e5391f44',
		name: 'shadow_0aac1ca3-a9d2-4587-ad9f-3e85e5391f44',
		proxy: '/shadow',
		text: `Some people involved were...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['reflection', 'personal'],
		form: 'story',
		id: '040850c1-9991-46be-b962-8cf4ad9cfb24',
		name: 'shadow_040850c1-9991-46be-b962-8cf4ad9cfb24',
		proxy: '/shadow',
		text: `In hindsight, I wish I had...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['personal', 'thoughts'],
		form: 'story',
		id: '447b70e7-a443-4165-becf-fbd74265a618',
		name: 'shadow_447b70e7-a443-4165-becf-fbd74265a618',
		proxy: '/shadow',
		text: `I remember thinking...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['personal', 'observation'],
		form: 'story',
		id: '6465905a-328e-4df1-8d3a-c37c3e05e227',
		name: 'shadow_6465905a-328e-4df1-8d3a-c37c3e05e227',
		proxy: '/shadow',
		text: `The mood of the scene was...`,
		type: 'member',
	},
	{
		being: 'shadow',
		categories: ['personal', 'reflection', 'observation'],
		form: 'story',
		id: 'e61616c7-00f9-4c23-9394-3df7e98f71e0',
		name: 'shadow_e61616c7-00f9-4c23-9394-3df7e98f71e0',
		proxy: '/shadow',
		text: `This was connected to larger themes in my life by ...`,
		type: 'member',
	},
]
const vmClassGenerator = vm.createContext({
	exports: {},
	console: console,
	import: async _module => await import(_module),
//	utils: utils,
//	sharedData: sharedData,
//	customModule: customModule,
//	eventEmitter: EventEmitter,
})
/* dependent constants and functions */
const mActorGeneric = await mDataservices.bot(undefined, 'actor')
const mActorQ = await mDataservices.bot(undefined, 'personal-avatar') // little-Q!
const mAlerts = {
	system: await mDataservices.getAlerts(), // not sure if we need other types in global module, but feasibly historical alerts could be stored here, etc.
}
// @todo: capitalize hard-codings as per actual schema classes
const mSchemas = {
	...await mLoadSchemas(),
	dataservices: Dataservices,
	menu: Menu,
	member: Member,
	session: MylifeMemberSession
}
/* module construction functions */
mConfigureSchemaPrototypes()
mPopulateBotInstructions()
/* logging/reporting */
console.log(chalk.bgRedBright('<-----AgentFactory module loaded----->'))
console.log(chalk.greenBright('schema-class-constructs'))
console.log(mSchemas)
/* module classes */
class BotFactory extends EventEmitter{
	// micro-hydration version of factory for use _by_ the MyLife server
	#dataservices
	#llmServices = mLLMServices
	#mbr_id
	constructor(mbr_id, directHydration=true){
		super()
		this.#mbr_id = mbr_id
		if(mIsMyLife(mbr_id) && directHydration)
			throw new Error('MyLife server cannot be accessed as a BotFactory alone')
		else if(mIsMyLife(this.mbr_id))
			this.#dataservices = mDataservices
		else if(directHydration)
			console.log(chalk.blueBright('BotFactory class instance for hydration request'), chalk.bgRed(this.mbr_id))
	}
	/* public functions */
	/**
	 * Initialization routine required for all bot instances. Note: MyLife cannot be constructed as a botFactory, so should never be called as such.
	 * @param {Guid} _mbr_id 
	 * @returns {AgentFactory} this
	 */
	async init(_mbr_id=this.mbr_id){
		this.#mbr_id = _mbr_id
		this.#dataservices = new Dataservices(this.mbr_id)
		await this.#dataservices.init()
		this.core.avatar_id = this.core.avatar_id
			?? (await this.dataservices.getAvatar())?.id
			?? (await this.getAvatar())?.id
		return this
	}
	/**
	 * Get a bot, either by id (when known) or bot-type (default=mDefaultBotType). If bot id is not found, then it cascades to the first entity of bot-type it finds.
	 * If caller is `MyLife` then bot is found or created and then activated via a micro-hydration.
	 * @todo - determine if spotlight-bot is required for any animation, or a micro-hydrated bot is sufficient.
	 * @public
	 * @param {string} id - The bot id
	 * @param {string} type - The bot type
	 * @param {string} mbr_id - The member id
	 * @returns {object} - The bot.
	 */
	async bot(id, type=mDefaultBotType, mbr_id){
		return ( await this.dataservices.getItem(id) )
			?? ( await this.dataservices.getItemByField(
					'bot',
					'type',
					type,
					undefined,
					mbr_id
				) )
	}
	/**
	 * Returns bot instruction set.
	 * @public
	 * @param {string} type - The bot type.
	 * @returns {object} - The bot instructions.
	 */
	botInstructions(type='personal-avatar'){
		return mBotInstructions[type]
	}
	/**
	 * Returns bot instructions version.
	 * @param {string} type - The bot type.
	 * @returns {number} - The bot instructions version.
	 */
	botInstructionsVersion(type){
		return mBotInstructions[type]?.version
			?? 1.0
	}
	/**
	 * Gets a member's bots, or specific bot types.
	 * @todo - develop bot class and implement hydrated instance
	 * @public
	 * @param {string} avatarId - The Avatarm id
	 * @param {string} botType - The bot type (optional)
	 * @returns {Object[]} - Array of bots
	 */
	async bots(avatarId, botType){
		const _params = avatarId?.length
			? [{ name: '@object_id', value: avatarId }]
			: botType?.length
				? [{ name: '@bot_type', value: botType }]
				: undefined
		const bots = await this.dataservices.getItems(
			'bot',
			undefined,
			_params,
		)
		return bots
	}
	/**
	 * Accesses Dataservices to challenge access to a member's account.
	 * @param {string} passphrase - The passphrase to challenge
	 * @param {boolean} caseInsensitive - Whether requestor suggests to ignore case in passphrase, defaults to `false`
	 * @returns {Promise<boolean>} - `true` if challenge successful
	 */
	async challengeAccess(passphrase, caseInsensitive=false){
		caseInsensitive = this.core.caseInsensitive
			?? caseInsensitive
		const challengeSuccessful = await mDataservices.challengeAccess(this.mbr_id, passphrase, caseInsensitive)
		return challengeSuccessful
	}
    /**
     * Get member collection items.
     * @param {string} type - The type of collection to retrieve, `false`-y = all.
     * @returns {array} - The collection items with no wrapper.
     */
	async collections(type){
		return await this.dataservices.collections(type)
	}
	/**
	 * Creates a bot in the database.
	 * @param {object} botData - The bot data
	 * @returns {object} - The created bot document
	 */
	async createBot(botData){
		const bot = await this.#dataservices.createBot(botData)
		return bot
	}
	/**
	 * Gets array of member `experiences` from database. When placed here, it allows for a bot to be spawned who has access to this information, which would make sense for a mini-avatar whose aim is to report what experiences a member has endured.
	 * @public
	 * @returns {Promise<array>} - Array of shorthand experience objects.
	 * @property {string<Guid>} id - The experience id.
	 * 
	 */
	async experiences(includeLived=false){
		// check consents for test-experiences [stub]
		let testExperiences = []
		// currently only system experiences exist
		let experiences = await mDataservices.getItems(
			'experience',
			undefined,
			[{ name: '@status', value: 'active' }],
			'system',
			) ?? []
		if(!includeLived){
			const livedExperiences = await this.experiencesLived() ?? []
			experiences = experiences.filter( // filter out `lived-experience.id`)
				experience=>!livedExperiences.find(
					livedExperience=>livedExperience.experience_id===experience.id
				)
			)
		}
		return experiences
	}
	/**
	 * Returns array of member `lived-experiences` from database.
	 * @returns {Promise<array>} - Array of lived experience objects.
	 */
	async experiencesLived(){
		const experienceFields = [
			'experience_date',
			'experience_id',
			'title',
			'variables', 
		]
		const livedExperiences = await this.dataservices.getItems(
			'lived-experience',
			experienceFields, // default includes being, id, mbr_id, object_id
		)
		return livedExperiences
	}
	/**
	 * Gets a specified `experience` from database.
	 * @public
	 * @param {guid} _experience_id - The experience id in Cosmos.
	 * @returns {Promise<object>} - The experience.
	 */
	async getExperience(_experience_id){
		if(!_experience_id) 
			throw new Error('factory.experience: experience id required')
		// @todo remove restriction (?) for all experiences to be stored under MyLife `mbr_id`
		return await mDataservices.getItem(_experience_id, 'system')
	}
	/**
	 * Retrieves a collection item by Id.
	 * @param {Guid} id - The id of the collection item to retrieve.
	 * @returns {object} - The item.
	 */
	async item(id){
		return await this.dataservices.getItem(id)
	}
	/**
	 * Proxy for modular mHelp() function.
	 * @public
     * @param {string} thread_id - The thread id.
     * @param {string} bot_id - The bot id.
     * @param {string} helpRequest - The help request string.
	 * @param {Avatar} avatar - The avatar instance.
	 * @returns {Promise<Object>} - openai `message` objects.
	 */
	async help(thread_id, bot_id, helpRequest, avatar){
		return await mHelp(thread_id, bot_id, helpRequest, this, avatar)
	}
    /**
     * Given an itemId, obscures aspects of contents of the data record. Consults modular LLM with isolated request and saves outcome to database.
     * @param {Guid} itemId - Id of the item to obscure
     * @returns {string} - The obscured content
     */
	async obscure(itemId){
		const { id, summary, relationships, } = await this.item(itemId)
			?? {}
		if(!id)
			throw new Error('Item not found')
		if(!summary?.length)
			throw new Error('No summary found to obscure')
		const obscuredSummary = await mObscure(this, summary)
		if(obscuredSummary?.length) /* save response */
			this.dataservices.patch(id, { summary: obscuredSummary }) // no need await
		return obscuredSummary
	}
    /**
     * Allows member to reset passphrase.
     * @param {string} passphrase 
     * @returns {boolean} - true if passphrase reset successful.
     */
    async resetPassphrase(passphrase){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot reset passphrase.')
        if(!passphrase?.length)
            throw new Error('Passphrase required for reset.')
        return await this.dataservices.resetPassphrase(passphrase)
    }
	/**
	 * Gets the list of shadows.
	 * @param {Guid} itemId - The itemId (or type?) to filter shadow return.
	 * @returns {object[]} - The shadows.
	 */
	async shadows(itemId){
		return mShadows
	}
	/**
	 * Gets a collection of stories of a certain format.
	 * @param {string} form - The form of the stories to retrieve
	 * @returns {object[]} - The stories
	 */
	async stories(form){
		return await this.dataservices.getItemsByFields(
			'story',
			[{ name: '@form', value: form }],
		)
	}
	/**
	 * Updates bot data in the database.
	 * @param {object} botData - The bot data to update
	 * @returns {Promise<object>} - the bot document from the database
	 */
	async updateBot(botData){
		const bot = await this.#dataservices.updateBot(botData)
		return bot
	}
	/* getters/setters */
	/**
	 * Returns the system actor bot data.
	 * @getter
	 * @returns {object} - The system actor bot data.
	 */
	get actorGeneric(){
		return mActorGeneric
	}
	/**
	 * Returns MyLife _Q_ actor bot data.
	 * @getter
	 * @returns {object} - Q actor bot data.
	 */
	get actorQ(){
		return mActorQ
	}
	get avatarId(){
		return this.core?.avatar_id
	}
	/**
	 * Returns member's dataservice core. USE WITH CAUTION!
	 * @todo - determine if this can be hidden from public access
	 * @getter
	 * @returns {object} - The Experience class definition.
	 */
	get core(){
		return this.dataservices.core
	}
	get dataservices(){
		return this.#dataservices
	}
	get dob(){
		let birthdate = this.core.birth[0].date
		if(birthdate?.length)
			birthdate = new Date(birthdate).toISOString().split('T')[0]
		return birthdate
	}
	/**
	 * Returns experience class definition.
	 */
	get experience(){
		return this.schemas.Experience
	}
	/**
	 * Returns the factory itself.
	 * @todo - deprecate?
	 */
	get factory(){
		return this
	}
	get globals(){
		return this.dataservices.globals
	}
	/**
	 * Returns whether or not the factory is the MyLife server, as various functions are not available to the server and some _only_ to the server.
	 * @returns {boolean}
	*/
	get isMyLife(){
		return mIsMyLife(this.mbr_id)
	}
	/**
	 * Returns the ExperieceLived class definition.
	 * @returns {object} - The ExperienceLived class definition.
	 */
	get livedExperience(){
		return this.schemas.ExperienceLived
	}
	get mbr_id(){
		return this.#mbr_id
			?? this.core.mbr_id
	}
	get mbr_id_id(){
		return this.globals.sysId(this.mbr_id)
	}
	get mbr_name(){
		return this.globals.sysName(this.mbr_id)
	}
	get memberFirstName(){
		return this.memberName
			?.split(' ')[0]
	}
	get memberName(){
		return this.core.names?.[0]
			?? this.mbr_name
	}
	get newGuid(){
		return mNewGuid()
	}
}
class AgentFactory extends BotFactory {
	#exposedSchemas = mExposedSchemas(['avatar','agent','consent','consent_log','relationship'])	//	run-once 'caching' for schemas exposed to the public, args are array of key-removals; ex: `avatar` is not an open class once extended by server
	#llmServices = mLLMServices
	constructor(mbr_id){
		super(mbr_id, false)
	}
	/* public functions */
	/**
	 * Initialization routine required for all AgentFactory instances save MyLife server.
	 * @param {string} mbr_id - Member id.
	 * @returns {AgentFactory} this
	 */
	async init(mbr_id){
		if(mIsMyLife(mbr_id))
			throw new Error('MyLife server AgentFactory cannot be initialized, as it references module dataservices on constructor().')
		await super.init(mbr_id)
		if(this.core.openaiapikey)
			this.#llmServices = new LLMServices(this.core.openaiapikey, this.core.openaiorgkey)
		return this
	}
	/**
	 * Retrieves all public experiences (i.e., owned by MyLife).
	 * @returns {Object[]} - An array of the currently available public experiences.
	 */
	async availableExperiences(){
		return await mDataservices.availableExperiences()
	}
	/**
	 * Retrieves or creates avatar properties from Member factory dataservices, or inherits the core data from Member class.
	 * @returns {object} - Avatar properties.
	 */
	async avatarProperties(){
		return ( await this.dataservices.getAvatar() )
	}
	/**
	 * Creates a new collection item in the member's container.
	 * @param {object} item - The item to create.
	 * @returns {object} - The created item.
	 */
	async createItem(item){
		const response = await this.dataservices.pushItem(item)
		return response
	}
    /**
     * Delete an item from member container.
     * @param {Guid} id - The id of the item to delete.
     * @returns {boolean} - true if item deleted successfully.
     */
	async deleteItem(id){
		return await this.dataservices.deleteItem(id)
	}
	async entry(entry){
		const defaultForm = 'journal'
		const defaultType = 'entry'
		const {
			being=defaultType,
			form=defaultForm,
			id=this.newGuid,
			keywords=[],
			mbr_id=this.mbr_id,
			summary,
			title=`Untitled ${ defaultForm } ${ defaultType }`,
		} = entry
		if(this.isMyLife)
			throw new Error('System cannot store entries of its own')
		let { name, } = entry
		name = name
			?? `${ defaultType }_${ form }_${ title.substring(0,64) }_${ mbr_id }`
		if(!summary?.length)
			throw new Error('entry summary required')
		/* assign default keywords */
		if(!keywords.includes('entry'))
			keywords.push('entry')
		if(!keywords.includes('journal'))
			keywords.push('journal')
		const _entry = {
			...entry,
			...{
			being,
			form,
			id,
			keywords,
			mbr_id,
			name,
			summary,
			title,
		}}
		return await this.dataservices.pushItem(_entry)
	}
	async getAlert(_alert_id){
		const _alert = mAlerts.system.find(alert => alert.id === _alert_id)
		return _alert ? _alert : await mDataservices.getAlert(_alert_id)
	}
	/**
	 * Returns all alerts of a given type, currently only _system_ alerts are available. Refreshes by definition from the database.
	 * @param {string} type 
	 * @returns {array} array of current alerts
	 */
	async getAlerts(type){
		const _systemAlerts = await this.dataservices.getAlerts()
		mAlerts.system = _systemAlerts
		return this.alerts
	}
	/**
	 * Retrieves member's Avatar data and creates singleton instance.
	 * @returns {Avatar} - The Avatar instance.
	 */
	async getAvatar(){
		const avatar = await ( new Avatar(this, this.#llmServices) )
			.init()
		return avatar
	}
	/**
	 * Generates via personal intelligence, nature of consent/protection around itemId or Bot id.
	 * @todo - build out consent structure
	 * @param {Guid} id - The id of the item to generate consent for.
	 * @param {Guid} requesting_mbr_id - The id of the member requesting consent.
	 * @returns {object} - The consent object, with parameters or natural language guidelines.
	 */
	async getConsent(id, requesting_mbr_id){
		//	consent is a special case, does not exist in database, is dynamically generated each time with sole purpose of granting access--stored for and in session, however, and attempted access there first... id of Consent should be same as id of object being _request_ so lookup will be straight-forward
		return new (mSchemas.consent)(consent, this)
	}
	/**
	 * Creates the member instance.
	 * @returns {Member} - The member instance.
	 */
	async getMyLifeMember(){
		const member =  await ( new (mSchemas.member)(this) )
			.init()
		return member
	}
	/**
	 * Creates the session instance.
	 * @todo - review this code and architecture.
	 * @returns {Session} - The Session instance.
	 */
	async getMyLifeSession(){
		// default is session based around default dataservices [Maht entertains guests]
		// **note**: consequences from this is that I must be careful to not abuse the module space for sessions, and regard those as _untouchable_
		return await new (mSchemas.session)(
			( new AgentFactory(mPartitionId) ) // no need to init (?)
		).init()
	}
	isAvatar(_avatar){	//	when unavailable from general schemas
		return (_avatar instanceof mSchemas.avatar)
	}
	isConsent(_consent){	//	when unavailable from general schemas
		return (_consent instanceof mSchemas.consent)
	}
	isSession(_session){	//	when unavailable from general schemas
		return (_session instanceof mSchemas.session)
	}
	/**
	 * Saves a completed lived experience to MyLife.
	 * @param {Object} experience - The Lived Experience Object to save.
	 * @returns 
	 */
	async saveExperience(experience){
		/* validate structure */
		if(!experience?.id?.length)
			throw new Error('experience id invalid')
		if(!experience?.location?.completed)
			throw new Error('experience not completed')
		/* clean experience */
		const { cast: _cast, events, id, title, variables, } = experience
		const cast = _cast.map(({ id, role }) => ({ id, role }))
		const _experience = {
			being: 'lived-experience',
			events: events
				.filter(event=>event?.dialog?.dialog?.length || event.character?.characterId?.length)
				.map(event=>{
					const { character: _character, dialog, id, input, } = event
					const character = cast.find(_cast=>_cast.id===_character?.characterId)
					if(_character?.role?.length)
						character.role = _character.role
					return {
						character: character?.role,
						dialog: dialog?.dialog,
						id,
						// input, // currently am not storing memberInput event correctly 
					}
				}),
			experience_date: Date.now(),
			experience_id: experience.id,
			id: this.newGuid,
			mbr_id: this.mbr_id,
			name: (`lived-experience_${ title }_${ id }`).substring(0, 256),
			title,
			variables,
		}
		const savedExperience = await this.dataservices.saveExperience(_experience)
		return savedExperience
	}
	/**
	 * Submits a story to MyLife. Currently called both from API _and_ LLM function.
	 * @param {object} story - Story object
	 * @returns {object} - The story document from Cosmos
	 */
	async story(story){
		const defaultForm = 'memory'
		const defaultType = 'story'
		const {
			being=defaultType,
			form=defaultForm,
			id=this.newGuid,
			keywords=[],
			mbr_id=(!this.isMyLife ? this.mbr_id : undefined),
			phaseOfLife='unknown',
			summary,
			title=`Untitled ${ defaultForm } ${ defaultType }`,
		} = story
		if(!mbr_id) // only triggered if not MyLife server
			throw new Error('mbr_id required for story summary')
		const { name=`${ being }_${ form }_${ title.substring(0,64) }_${ mbr_id }`, } = story
		if(!summary?.length)
			throw new Error('story summary required')
		/* assign default keywords */
		if(!keywords.includes('memory'))
			keywords.push('memory')
		if(!keywords.includes('biographer'))
			keywords.push('biographer')
		const _story = { // add validated fields back into `story` object
			...story,
			...{
				being,
				form,
				id,
				keywords,
				mbr_id,
				name,
				phaseOfLife,
				summary,
				title,
			}}
		return await this.dataservices.pushItem(_story)
	}
	async summary(summary){
		const { being='story', } = summary
		switch(being){
			case 'entry':
				return await this.entry(summary)
			case 'memory':
			case 'story':
				return await this.story(summary)
			default:
				throw new Error('summary being not recognized')
		}
	}
	/**
	 * Tests partition key for member
	 * @public
	 * @param {string} mbr_id member id
	 * @returns {boolean}  - `true` if partition key is active, `false` otherwise.
	 */
	async testPartitionKey(mbr_id){
		if(!this.isMyLife)
			return false
		return await mDataservices.testPartitionKey(mbr_id)
	}
	/**
	 * Updates a collection item.
	 * @param {object} item - The item to update
	 * @property {Guid} item.id - The item id
	 * @returns {Promise<object>} - The updated item
	 */
	async updateItem(item){
		if(!this.globals.isValidGuid(item?.id))
			throw new Error('item id required for update')
		const response = await this.dataservices.patch(item.id, item)
		return response
	}
	/* getters/setters */
	get alerts(){ // currently only returns system alerts
		return mAlerts.system
	}
	/**
	 * Returns the ExperienceCastMember class definition.
	 * @returns {object} - ExperienceCastMember class definition.
	 */
	get castMember(){
		return this.schemas.ExperienceCastMember
	}
	get contribution(){
		return this.schemas.Contribution
	}
	get conversation(){
		return this.schemas.Conversation
	}
	/**
	 * Returns the ExperienceEvent class definition.
	 * @returns {object} - ExperienceEvent class definition.
	 */
	get experienceEvent(){
		return this.schemas.ExperienceEvent
	}
	get file(){
		return this.schemas.File
	}
	get message(){
		return this.schemas.Message
	}
	get organization(){
		return this.schemas.Organization
	}
	get schema(){	//	proxy for schemas
		return this.schemas
	}
	get schemaList(){	//	proxy for schemas
		return Object.keys(this.schemas)
	}
	get schemas(){
		return this.#exposedSchemas
	}
	get urlEmbeddingServer(){
		return process.env.MYLIFE_EMBEDDING_SERVER_URL+':'+process.env.MYLIFE_EMBEDDING_SERVER_PORT
	}
}
class MyLifeFactory extends AgentFactory {
	#dataservices = mDataservices
	#llmServices = mLLMServices
	#registrationData
	constructor(){
		super(mPartitionId)
	} // no init() for MyLife server
	/* public functions */
	/**
	 * MyLife factory is able to hydrate a BotFactory instance of a Member Avatar.
	 * @public
	 * @param {string} mbr_id - The member id
	 * @returns {object} - The hydrated bot instance
	 */
	async avatarProxy(mbr_id){
		const Bot = await new BotFactory(mbr_id)
			.init()
		return Bot
	}
	/**
	 * Accesses Dataservices to challenge access to a member's account.
	 * @public
	 * @param {string} mbr_id - The member id
	 * @param {string} passphrase - The passphrase to challenge
	 * @returns {object} - Returns passphrase document if access is granted.
	 */
	async challengeAccess(mbr_id, passphrase){
		const caseInsensitive = true // MyLife server defaults to case-insensitive
		const avatarProxy = await this.avatarProxy(mbr_id)
		const challengeSuccessful = await avatarProxy.challengeAccess(passphrase, caseInsensitive)
		return challengeSuccessful
	}
	/**
	 * Compares registration email against supplied email to confirm `true`. **Note**: does not care if user enters an improper email, it will only fail the encounter, as email structure _is_ confirmed upon initial data write.
	 * @param {string} email - The supplied email to confirm registration.
	 * @param {Guid} registrationId - The registration id.
	 * @returns {boolean} - `true` if registration confirmed.
	 */
	confirmRegistration(email, registrationId){
		if(!this.#registrationData)
			return false
		const { email: registrationEmail, id, } = this.#registrationData
		const confirmed = id===registrationId
			&& typeof email==='string'
			&& typeof registrationEmail==='string' // humor me, as it error-proofs next condition
			&& registrationEmail.toLowerCase()===email.toLowerCase()
		this.#registrationData.confirmed = confirmed
		return confirmed
	}
	/**
	 * Set MyLife core account basics. { birthdate, passphrase, }
	 * @todo - move to mylife agent factory
	 * @param {string} birthdate - The birthdate of the member.
	 * @param {string} passphrase - The passphrase of the member.
	 * @returns {boolean} - `true` if successful
	 */
	async createAccount(birthdate, passphrase){
		/* get registration data */
		let avatarName,
			memberAccount = {}
		/* create account core */
		try {
			const { avatarName: _avatarName, email, humanName, id, interests, } = this.#registrationData
			let { updates='', } = this.#registrationData
			if(!id)
				throw new Error('registration not confirmed, cannot accept request')
			if(!humanName)
				throw new Error('member personal name required to create account')
			const avatarId = this.newGuid
			avatarName = _avatarName ?? `${ humanName }-AI`
			birthdate = new Date(birthdate).toISOString()
			if(!birthdate?.length)
				throw new Error('birthdate format could not be parsed')
			const birth = [{ // current 20240523 format
				date: birthdate,
			}]
			const mbr_id = this.globals.createMbr_id(avatarName ?? humanName, id)
			if(await this.testPartitionKey(mbr_id))
				throw new Error('mbr_id already exists')
			const names = [humanName] // currently array of flat strings
			updates = (updates.length ? ' ' : '')
				+ `${ humanName } joined MyLife on ${ new Date().toDateString() }`
			const validations = ['registration',] // list of passed validation routines
			const core = {
				avatarId,
				birth,
				email,
				id,
				interests,
				mbr_id,
				names,
				passphrase,
				updates,
				validations,
			}
			memberAccount = await this.dataservices.addCore(core) ?? {}
			this.#registrationData = null
		} catch(error) {
			console.log(chalk.blueBright('createAccount()::createCore()::error'), chalk.bgRed(error))
		}
		/* create avatar */
		if(Object.keys(memberAccount)?.length){
			try{
				return await this.dataservices.addAvatar(memberAccount?.core) ?? {}
			} catch(error) { 
				console.log(chalk.blueBright('createAccount()::createAvatar()::error'), chalk.bgRed(error))
			}
		}
	}
	createItem(){
		throw new Error('MyLife server cannot create items')
	}
	/**
	 * 
	 * @param {string} mbr_id - The member id
	 * @returns {object} - The member's core data
	 */
	async datacore(mbr_id){
		const core = ( await mDataservices.getItems('core', null, null, null, mbr_id) )
			?.[0]
		return core
	}
	deleteItem(){
		throw new Error('MyLife server cannot delete items')
	}
	/**
	 * Retrieves member's Avatar data and creates singleton instance.
	 * @returns {Avatar} - The Avatar instance.
	 */
	async getAvatar(){
		const avatar = await ( new Q(this, this.#llmServices) )
			.init()
		return avatar
	}
	/**
	 * Returns Array of hosted members based on validation requirements.
	 * @param {Array} validations - Array of validation strings to filter membership.
	 * @returns {Promise<Array>} - Array of string ids, one for each hosted member.
	 */
	async hostedMembers(validations){
		return await this.#dataservices.hostedMembers(validations)
	}
	/**
	 * Registers a new candidate to MyLife membership
	 * @public
	 * @param {object} candidate { 'avatarName': string, 'email': string, 'humanName': string, }
	 * @returns {object} - The registration document from Cosmos.
	 */
	async registerCandidate(candidate){
		return await this.#dataservices.registerCandidate(candidate)
	}
	updateItem(){
		console.log(chalk.blueBright('MyLifeFactory::updateItem()::error'), chalk.bgRed('updateItem Request, but MyLife server cannot update items'))
	}
    /**
     * Validate registration id.
     * @param {Guid} validationId - The registration id.
     * @returns {Promise<object>} - Registration data from system datacore.
     */
	async validateRegistration(registrationId){
		if(!registrationId?.length)
			throw new Error('registration id required')
		let registration,
			success = false
		try{
			registration = await this.dataservices.validateRegistration(registrationId)
			const { id, } = registration
			if(id===registrationId){
				success = true
				this.#registrationData = registration
				setTimeout(timeout=>{ // Set a timeout to clear the data after 5 minutes (300000 milliseconds)
					this.#registrationData = null
				}, 5 * 60 * 1000)
			}
		} catch(error){
			this.#registrationData = null
			console.log(chalk.blueBright(`validateRegistration(${ registrationId })::error`), error.message)
		}
		return this.#registrationData
	}
	/* getters/setters */
    /**
     * Test whether avatar session is creating an account.
     * @getter
     * @returns {boolean} - Avatar is in `accountCreation` mode (true) or not (false).
     */
    get isCreatingAccount(){
        return this.#registrationData?.confirmed===true
    }
    /**
     * Test whether factory is currently `validating` a session.
     * @getter
     * @returns {boolean} - Avatar is in `registering` mode (true) or not (false).
     */
    get isValidating(){
		return this.#registrationData?.validated===true && !this.#registrationData?.confirmed
    }
	get registrationData(){
		return this.#registrationData
	}
	get registrationId(){
		return this.#registrationData?.id
	}
}
// private module functions
function assignClassPropertyValues(propertyDefinition){
	switch (true) {
		case propertyDefinition?.const!==undefined:	//	constants
			return `'${propertyDefinition.const}'`
		case propertyDefinition?.default!==undefined:	//	defaults: bypass logic
			if(Array.isArray(propertyDefinition.default)){
				return '[]'
			}
			return `'${ propertyDefinition.default }'`
		default:
			//	presumption: propertyDefinition.type is not array [though can be]
			switch (propertyDefinition?.type) {
				case 'array':
					return '[]'
				case 'boolean':
					return false
				case 'integer':
				case 'number':
					return 0
				case 'string':
					switch (propertyDefinition?.format) {
						case 'date':
						case 'date-time':
							return `'${new Date().toDateString()}'`
						case 'uuid':
							return `'${Guid.newGuid().toString()}'`
						case 'email':
						case 'uri':
						default:
							return null
					}
				case undefined:
				default:
					return null
			}
	}
}
function mBytes(_object){
	return util.inspect(_object).length
}
function mCompileClass(_className, _classCode){
	vm.runInContext(_classCode, vmClassGenerator) // Create a global vm context and run the class code in it
	const _class = vmClassGenerator.exports[_className] // Return the compiled class
	return _class // Return the compiled class
}
async function mConfigureSchemaPrototypes(){ //	add required functionality as decorated extension class
	for(const _className in mSchemas){
		//	global injections; maintained _outside_ of eval class
		Object.assign(
			mSchemas[_className].prototype,
			{ mSanitizeSchemaValue: mSanitizeSchemaValue },
		)
		mSchemas[_className] = mExtendClass(mSchemas[_className])
	}
}
function mExposedSchemas(factoryBlockedSchemas){
	const _systemBlockedSchemas = ['dataservices','session']
	return Object.keys(mSchemas)
		.filter(key => !_systemBlockedSchemas.includes(key) && !factoryBlockedSchemas.includes(key))
		.reduce((obj, key) => {
			obj[key] = mSchemas[key]
			return obj
		}, {})
}
/**
 * Ingests schema and returns an array of class definitions based upon any number of recursive `$defs`
 * @param {object} _schema - Schema for class and sub-`$defs`
 * @returns {array} - Returns array of unsanitized class definitions
 */
function mExtractClassesFromSchema(_schema){
	const _classes = []
	function _extractClasses(__schema){
		const { $defs={}, ...rootSchema } = __schema
		_classes.push(rootSchema)
		Object.keys($defs)
			.forEach(_key=>{
				_classes.push($defs[_key])
				if ($defs[_key].$defs) {
					_extractClasses($defs[_key])
				}
			})
	}
	_extractClasses(_schema)
	return _classes
}
function mExtendClass(_class) {
	const _className = _class.name.toLowerCase()
	if (typeof mExtensionFunctions?.[`extendClass_${_className}`]==='function'){
		console.log(`Extension function found for ${_className}`)
		//	add extension decorations
		const _references = { openai: mLLMServices }
		_class = mExtensionFunctions[`extendClass_${_className}`](_class, _references)
	}
	return _class
}
/**
 * Ingests components of the JSON schema and generates text for class code.
 * @param {string} _className - Sanitized class name
 * @param {object} properties - Sanitized properties of class
 * @returns {string} - Returns class code in text format for rendering into node js object
 */
function mGenerateClassCode(_className, properties){
	//	delete known excluded properties in source
	for(const prop in properties){
		if(prop in mExcludeProperties){ delete properties[prop] }
	}
	// Generate class
	let classCode = `
// Code will run in vm and pass back class
class ${_className} {
// private properties
#excludeConstructors = ${ '['+Object.keys(mExcludeProperties).map(key => "'" + key + "'").join(',')+']' }
#name
`
	for (const prop in properties) {	//	assign default values as animated from schema
		const _value = mSanitizeSchemaValue(assignClassPropertyValues(properties[prop]))
		//	this is the value in error that needs sanitizing
		classCode += `	#${(_value)?`${prop} = ${_value}`:prop}\n`
	}
	classCode += `
// class constructor
constructor(obj){
	try{
		for(const _key in obj){
			//	exclude known private properties and db properties beginning with '_'
			if(this.#excludeConstructors.filter(_=>{ return (_==_key || _key.charAt(0)=='_')}).length) { continue }
			try{
				eval(\`this.\#\${_key}=obj[_key]\`)
			} catch(err){
				eval(\`this.\${_key}=obj[_key]\`)
			}
		}
		console.log('vm ${ _className } class constructed')
	} catch(err) {
		console.log(\`FATAL ERROR CREATING \${obj.being}\`, err)
		rethrow
	}
}
// if id changes are necessary, then use set .id() to trigger the change
// getters/setters for private vars`
	for (const prop in properties) {
		const type = properties[prop].type
		// generate getters/setters
		classCode += `
get ${ prop }(){
	return this.#${ prop }
}
set ${ prop }(_value) {	// setter with type validation
	if(typeof _value !== '${ type }' && '${ type }' !== 'undefined'){
		if(!('${ type }'==='array' && Array.isArray(_value))){
			throw new Error('Invalid type for property ${ prop }: expected ${ type }')
		}
	}
	if(this?.#${ prop }) this.#${ prop } = _value
	else this.${ prop } = _value
}`
	}
	//	functions
	//	inspect: returns a object representation of available private properties
	classCode += `	// public functions
inspect(_all=false){
	let _this = (_all)?{`
	for (const prop in properties) {
		classCode += `			${ prop }: this.#${ prop },\n`
	}
	classCode += `		}:{}
	return {...this,..._this}
}
}
exports.${_className} = ${_className}`
	return classCode
}
function mGenerateClassFromSchema(_schema) {
	const { name, properties } = _schema
	const _classCode = mGenerateClassCode(name, properties)
	const _class = mCompileClass(name, _classCode)
	return _class
}
/**
 * Take help request about MyLife and consults appropriate engine for response.
 * @requires mLLMServices - equivalent of default MyLife dataservices/factory
 * @param {string} thread_id - The thread id.
 * @param {string} bot_id - The bot id.
 * @param {string} helpRequest - The help request string.
 * @param {AgentFactory} factory - The AgentFactory object; **note**: ensure prior that it is generic Q-conversation.
 * @param {Avatar} avatar - The avatar instance.
 * @returns {Promise<Object>} - openai `message` objects.
 */
async function mHelp(thread_id, bot_id, helpRequest, factory, avatar){
	const response = await mLLMServices.help(thread_id, bot_id, helpRequest, factory, avatar)
	return response
}
/**
 * Returns whether or not the factory is the MyLife server, as various functions are not available to the server and some _only_ to the server.
 * @param {string} _mbr_id 
 * @returns {boolean} true if factory is MyLife server
 */
function mIsMyLife(_mbr_id){
	return _mbr_id===mPartitionId
}
async function mLoadSchemas(){
	try{
		let _filesArray = await (fs.readdir(mPath))
		_filesArray = _filesArray.filter(_filename => _filename.split('.')[1] === 'json')
		const _schemasArray = (await Promise.all(
			_filesArray.map(
				async _filename => {
					const _file = await fs.readFile(`${mPath}/${_filename}`, 'utf8')
					const _fileContent = JSON.parse(_file)
					let _classArray = mSanitizeSchema(_fileContent)
					// generate classes from schema array
					_classArray = _classArray.map(_class => {
						const _classObject = mGenerateClassFromSchema(_class)
						return _classObject
					})
					return _classArray
				}
			)
		))
			.flat()
		const _schemasObject =  _schemasArray.reduce((_schema, _class) => {
			_schema[_class.name] = _class
			return _schema
		}, {})
		return _schemasObject
	} catch(err){
		console.log(err)
	}
}
/**
 * Given an itemId, obscures aspects of contents of the data record.
 * @param {AgentFactory} factory - The factory object
 * @param {Guid} iid - The item id
 * @returns {Object} - The obscured item object
 */
async function mObscure(factory, summary) {
    const { mbr_id } = factory
	let obscuredSummary
    // @stub - if greater than limit, turn into text file and add
    const prompt = `OBSCURE:\n${summary}`
    const messageArray = await mLLMServices.getLLMResponse(null, mGeneralBotId, prompt)
	const { content: contentArray=[], } = messageArray?.[0] ?? {}
	const { value, } = contentArray
		.filter(message=>message.type==='text')
		?.[0]
		?.text
			?? {}
    try {
		let parsedSummary = JSON.parse(value)
        if(typeof parsedSummary==='object' && parsedSummary!==null)
            obscuredSummary = parsedSummary.obscuredSummary
    } catch(e) {} // obscuredSummary is just a string; use as-is or null
	return obscuredSummary
}
async function mPopulateBotInstructions(){
	const instructionSets = await mDataservices.botInstructions()
	instructionSets
		.forEach(instructionSet=>{
			const { type, } = instructionSet
			mBotInstructions[type] = instructionSet
		})
}
/**
 * Ingests a text (or JSON-parsed) schema and returns an array of sanitized schema.
 * @param {object} _schema 
 * @returns {Array} - Array of sanitized schemas
 */
function mSanitizeSchema(_schema){
	if(!_schema) throw new Error('schema required')
	if(typeof _schema === 'string') _schema = JSON.parse(_schema)
	if(!(_schema?.name && _schema?.properties)) throw new Error('schema content required')
	// convert class name and $defs keys to camelCase where space or dash is found; also affect $ref values in parent
	const _classes = mSanitizeSchemaClasses(_schema) // will mutate properties && _sanitizedKeysObject
	return _classes
}
/**
 * Ingests a schema, mends improper variable names and fixes `$refs`, `$defs` and `required` and returns array of classes based on `$defs`.
 * @param {object} _schema - Validated schema with properties to mutate.
 * @returns {array} - Array of sanitized class definitions, one for each `$def`.
 */
function mSanitizeSchemaClasses(_schema){
	const _sanitizedKeysObject = {} // reference collection for $ref keys
	const _classes = mExtractClassesFromSchema(_schema) // container for list of sanitized class definitions to return
	const mutatedKeys = {}
	_classes.map(_class=>mSanitizeSchemaKeys(_class, mutatedKeys))
	if(Object.keys(mutatedKeys).length){
		_classes.forEach(_class=>{
			const { name: _name, properties: properties } = _class
			mSanitizeSchemaReferences(properties, mutatedKeys)
			// recursively loop `properties` for key `$ref`
			Object.keys(properties)
				.forEach(_key=>mSanitizeSchemaReferences(_key, mutatedKeys))

		})
	}
	return _classes
}
/**
 * Sanitizes a key to be used as a class property name.
 * @param {string} _key - Key to sanitize
 * @returns {string} - Sanitized key
 */
function mSanitizeSchemaKey(_key){
    // Create a regular expression pattern to match any of the special characters
    const pattern = new RegExp(`[${mReservedJSCharacters.map(char => `\\${char}`).join('')}]`, 'g')
    // Split the key into segments by the special characters and then convert segments into camelCase
    const segments = _key.split(pattern)
    let sanitizedKey = segments.map((segment, index) => 
        index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)
    ).join('')
	if(mReservedJSWords.includes(sanitizedKey)) sanitizedKey+='_key'
    return sanitizedKey
}
/**
 * Ingests a class definition and sanitizes its keys.
 * @module
 * @param {object} _class - Class definition to sanitize.
 * @param {object} _mutatedKeysObject - Object to hold mutated sanitized keys.
 * @returns {void} - Internally mutates parameter references.
 */
function mSanitizeSchemaKeys(_class, _mutatedKeysObject){
	const { name, properties, required} = _class
	const _sanitizedClassName = mSanitizeSchemaKey(name)
	if(_sanitizedClassName!==name){
		_mutatedKeysObject[name.toLowerCase()] = _sanitizedClassName
		_class.name = _sanitizedClassName
	}
	Object.keys(properties).forEach(_key=>{
		const _sanitizedKey = mSanitizeSchemaKey(_key)
		if(_sanitizedKey!==_key){
			properties[_sanitizedKey] = properties[_key]
			if(required.includes(_key)){ // _required_ is an array of strings
				required[required.indexOf(_key)] = _sanitizedKey
			}
			delete properties[_key]
		}
	})
}
function mSanitizeSchemaReferences(properties, _mutatedKeysObject){
	Object.keys(properties)
		.forEach(_key=>{
			if(_key==='$ref'){
				// mutate $ref key
				const _classReferenceName = properties['$ref'].split('/').pop()
				const _sanitizedKey = _mutatedKeysObject[_classReferenceName]
					?? _mutatedKeysObject[_classReferenceName.toLowerCase()]
				if(_sanitizedKey){
					// set $ref to sanitized key, as that will be the actual Class Name inside MyLife. **note**: remove all '/$defs/' as there is no nesting inside `schemas`
					properties['$ref'] = _sanitizedKey
				}
			} else if(typeof properties[_key] === 'object'){
				mSanitizeSchemaReferences( properties[_key], _mutatedKeysObject )
			}
	})
}
function mSanitizeSchemaValue(_value) {
    if (typeof _value !== 'string') return _value

    let startsWithQuote = _value.startsWith("'") || _value.startsWith('"') || _value.startsWith('`')
    let endsWithQuote = _value.endsWith("'") || _value.endsWith('"') || _value.endsWith('`')
    let wasTrimmed = startsWithQuote && endsWithQuote && _value[0] === _value[_value.length - 1]

    let trimmedStr = wasTrimmed ? _value.substring(1, _value.length - 1) : _value
    trimmedStr = trimmedStr.replace(/(?<!\\)[`\\$'"]/g, "\\$&")

    return wasTrimmed ? _value[0] + trimmedStr + _value[0] : trimmedStr
}
/**
 * Decouples team from modular reference.
 * @param {object} team - Team object from modular codespace
 * @returns {object} - Returns sanitized team object
 */
function mTeam(team){
    const {
        allowCustom,
        allowedTypes,
        defaultTypes,
        description,
        id,
        name,
        title,
    } = team
    return {
        allowCustom,
        allowedTypes: [...allowedTypes],
        defaultTypes: [...defaultTypes],
        description,
        id,
        name,
        title,
    }
}
/* final constructs relying on class and functions */
// server build: injects default factory into _server_ **MyLife** instance
const _MyLife = await new MyLife(
	new MyLifeFactory()
)
	.init()
/* exports */
export default _MyLife