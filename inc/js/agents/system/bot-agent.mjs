/* module constants */
const mBot_idOverride = process.env.OPENAI_MAHT_GPT_OVERRIDE
const mDefaultBotTypeArray = ['personal-avatar', 'avatar']
const mDefaultBotType = mDefaultBotTypeArray[0]
const mDefaultGreeting = 'Hello! If you need to know how to get started, just ask!'
const mDefaultGreetings = ['Welcome to MyLife! I am here to help you!']
const mDefaultTeam = 'memory'
const mRequiredBotTypes = ['personal-avatar']
const mTeams = [
	{
		active: true,
		allowCustom: true,
		allowedTypes: ['diary', 'journaler', 'personal-biographer',],
		defaultActiveType: 'personal-biographer',
		defaultTypes: ['personal-biographer',],
		description: 'The Memory Team is dedicated to help you document your life stories, experiences, thoughts, and feelings.',
		id: 'a261651e-51b3-44ec-a081-a8283b70369d',
		name: 'memory',
		title: 'Memory',
	},
]
/* classes */
/**
 * @class - Bot
 * @private
 * @todo - are private vars for factory and llm necessary, or passable?
 */
class Bot {
	#collectionsAgent
	#conversation
	#factory
	#feedback
	#initialGreeting
	#greetings
	#instructionNodes = new Set()
	#llm
	#type
	constructor(botData, llm, factory){
		this.#factory = factory
		this.#llm = llm
		const { feedback=[], greeting=mDefaultGreeting, greetings=mDefaultGreetings, type=mDefaultBotType, ..._botData } = botData
		this.#feedback = feedback
		this.#greetings = greetings
		this.#initialGreeting = greeting
		this.#type = type
		Object.assign(this, this.globals.sanitize(_botData))
		switch(type){
			case 'diary':
			case 'journal':
			case 'journaler':
				this.#instructionNodes.add('interests')
				this.#instructionNodes.add('flags')
				break
			case 'personal-biographer':
			default:
				this.#instructionNodes.add('interests')
				break
		}
		// @stub - this.#collectionsAgent = new CollectionsAgent(llm, factory)
	}
	/* public functions */
	/**
	 * Chat with the active bot.
	 * @todo - deprecate avatar in favor of either botAgent or `this`
	 * @param {String} message - The member request
	 * @param {String} originalMessage - The original message
	 * @param {Boolean} allowSave - Whether to save the conversation, defaults to `true`
	 * @param {Avatar} avatar - The Member Avatar instance
	 * @returns {Promise<Conversation>} - The Conversation instance updated with the chat exchange
	 */
	async chat(message, originalMessage, allowSave=true, avatar){
		if(this.isMyLife && !this.isAvatar)
			throw new Error('Only Q, MyLife Corporate Intelligence, is available for non-member conversation.')
		const Conversation = await this.getConversation()
		Conversation.prompt = message
		Conversation.originalPrompt = originalMessage
		await mCallLLM(Conversation, allowSave, this.#llm, this.#factory, avatar) // mutates Conversation
        /* frontend mutations */
		return Conversation
	}
    /**
     * Get collection items for this bot.
     * @returns {Promise<Array>} - The collection items (no wrapper)
     */
	async collections(){
		let type = this.type
		switch(type){
			case 'diary':
			case 'journal':
			case 'journaler':
				type='entry'
				break
			case 'biographer':
			case 'personal-biographer':
				type = 'memory'
				break
			default:
				break
		}
		const collections = ( await this.#factory.collections(type) )
		return collections
	}
    /**
     * Submits message content and id feedback to bot.
     * @param {String} message_id - LLM message id
     * @param {Boolean} isPositive - Positive or negative feedback, defaults to `true`
     * @param {String} message - Message content (optional)
     * @returns {Object} - The feedback object
     */
	async feedback(message_id, isPositive=true, message=''){
		if(!message_id?.length)
			console.log('feedback message_id required')
		this.#feedback.push(isPositive)
		const botData = { feedback: this.#feedback, }
		const botOptions = { instructions: false, }
		this.update(botData, botOptions) // no `await`
		if(message.length)
			console.log(`feedback regarding agent message`, message)
		const response = {
			message,
			message_id,
			success: true,
		}
		return response
	}
	/**
	 * Retrieves `this` Bot instance.
	 * @returns {Bot} - The Bot instance
	 */
	getBot(){
		return this
	}
	/**
	 * Retrieves the Conversation instance for this bot, creating a new one if .
	 * @param {String} message - The member request (optional)
	 * @returns {Promise<Conversation>} - The Conversation instance
	 */
	async getConversation(message){
		if(!this.#conversation){
			const { bot_id: _llm_id, id, type, } = this
			let { llm_id=_llm_id, thread_id, } = this // @stub - deprecate bot_id
			this.#conversation = await mConversationStart('chat', type, id, thread_id, llm_id, this.#llm, this.#factory, message)
			if(!thread_id?.length){
				thread_id = this.#conversation.thread_id
				this.update({
					id,
					thread_id,
				})
			}
		}
		return this.#conversation
	}
	/**
	 * Retrieves a greeting message from the active bot.
	 * @param {Boolean} dynamic - Whether to use dynamic greetings (`true`) or static (`false`)
	 * @param {String} greetingPrompt - The prompt for the dynamic greeting
	 * @returns {String} - The greeting message string
	 */
	async greeting(dynamic=false, greetingPrompt='Greet me and tell me briefly what we did last'){
		if(!this.llm_id)
			throw new Error('Bot initialized incorrectly: missing `llm_id` from database')
		const greetings = dynamic
			? await mBotGreetings(this.thread_id, this.llm_id, greetingPrompt, this.#llm, this.#factory)
			: this.greetings
		const greeting = greetings[Math.floor(Math.random() * greetings.length)]
		return greeting
	}
    /**
     * Migrates Conversation from an old thread to a newly-created destination thread, observable in `this.Conversation`.
     * @returns {void}
     */
	async migrateChat(){
		await mMigrateChat(this, this.#llm)
	}
    /**
     * Given an itemId, obscures aspects of contents of the data record. Obscure is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM.
     * @param {Guid} itemId - The item id
     * @returns {Object} - The obscured item object
     */
	async obscure(itemId){
        const updatedSummary = await this.#factory.obscure(itemId)
		return updatedSummary
	}
	/**
	 * Updates a Bot instance's data.
	 * @param {object} botData - The bot data to update
	 * @param {object} botOptions - Options for updating
	 * @returns {Promise<Bot>} - The updated Bot instance
	 */
	async update(botData, botOptions={}){
		/* validate request */
		this.globals.sanitize(botData)
		/* execute request */
		botOptions.instructions = botOptions.instructions
			?? Object.keys(botData).some(key => this.#instructionNodes.has(key))
		const { feedback, id, mbr_id, type, ...updatedNodes } = await mBotUpdate(botData, botOptions, this, this.#llm, this.#factory)
		Object.assign(this, updatedNodes)
		/* respond request */
		return this
	}
	/**
	 * Sets the thread id for the bot.
	 * @param {String} thread_id - The thread id
	 * @returns {Promise<void>}
	 */
	async setThread(thread_id){
		if(!thread_id?.length)
			thread_id = ( await mThread(this.#llm) ).id
		const { id, } = this
		this.thread_id = thread_id
		const bot = {
			id,
			thread_id,
		}
		await this.#factory.updateBot(bot)
	}
	/* getters/setters */
	/**
	 * Gets the frontend bot object.
	 * @getter
	 */
	get bot() {
		const { bot_name: name, description, flags, id, interests, purpose, type, version } = this
		const bot = {
			description,
			flags,
			id,
			interests,
			name,
			purpose,
			type,
			version,
		}
		return bot
	}
	get conversation(){
		return this.#conversation
	}
	get globals(){
		return this.#factory.globals
	}
	get greetings(){
		return this.#greetings
	}
	get instructionNodes(){
		return this.#instructionNodes
	}
	set instructionNodes(instructionNode){
		this.#instructionNodes.add(instructionNode)
	}
	get instructionNodeValues(){
		return [...this.#instructionNodes].reduce((acc, key)=>{
			acc[key] = this[key]
			return acc
		}, {})
	}
	get isAvatar(){
		return mDefaultBotTypeArray.includes(this.type)
	}
	get isBiographer(){
		return ['personal-biographer', 'biographer'].includes(this.type)
	}
	get isMyLife(){
		return this.#factory.isMyLife
	}
	get micro(){
		const {
			bot_name,
			id,
			name,
			provider,
			type,
			version,
		} = this
		const microBot = {
			bot_name,
			id,
			name,
			provider,
			type,
			version,
		}
		return microBot
	}
	get type(){
		return this.#type
	}
}
/**
 * @class - Team
 * @private
 */
/**
 * @class - BotAgent
 * @public
 * @description - BotAgent is an interface to assist in creating, managing and maintaining a Member Avatar's bots.
 */
class BotAgent {
	#activeBot
    #activeTeam = mDefaultTeam
    #avatarId
    #bots
    #factory
	#fileConversation
	#llm
	#vectorstoreId
    constructor(factory, llm){
        this.#factory = factory
        this.#llm = llm
    }
	/**
	 * Initializes the BotAgent instance.
	 * @async
	 * @param {Guid} avatarId - The Avatar id
	 * @param {string} vectorstoreId - The Vectorstore id
	 * @returns {Promise<BotAgent>} - The BotAgent instance
	 */
    async init(avatarId, vectorstoreId){
		/* validate request */
        if(!avatarId?.length)
            throw new Error('AvatarId required')
        this.#avatarId = avatarId
		this.#bots = []
		this.#vectorstoreId = vectorstoreId
		/* execute request */
		await mInit(this, this.#bots, this.#factory, this.#llm)
		return this
    }
	/* public functions */
	/**
	 * Retrieves Bot instance by id or type, defaults to personal-avatar.
	 * @param {Guid} bot_id - The Bot id
	 * @param {String} botType - The Bot type
	 * @returns {Promise<Bot>} - The Bot instance
	 */
	bot(bot_id, botType){
		const Bot = botType?.length
			? this.#bots.find(bot=>bot.type===botType)
			: this.#bots.find(bot=>bot.id===bot_id)
			?? this.avatar
		return Bot
	}
	/**
	 * Creates a bot instance.
	 * @param {Object} botData - The bot data object
	 * @returns {Bot} - The created Bot instance
	 */
	async botCreate(botData){
		const Bot = await mBotCreate(this.#avatarId, this.#vectorstoreId, botData, this.#llm, this.#factory)
		this.#bots.push(Bot)
		this.setActiveBot(Bot.id)
		return Bot
	}
	/**
	 * Deletes a bot instance.
	 * @async
	 * @param {Guid} bot_id - The Bot id
	 * @returns {Promise<Boolean>} - Whether or not operation was successful
	 */
	async botDelete(bot_id){
		if(this.#factory.isMyLife)
			return false
		const success = await mBotDelete(bot_id, this, this.#llm, this.#factory)
		return success
	}
	/**
	 * Chat with the active bot.
	 * @param {Conversation} Conversation - The Conversation instance
	 * @param {Boolean} allowSave - Whether to save the conversation, defaults to `true`
	 * @param {Q} q - The avatar id
	 * @returns {Promise<Conversation>} - The Conversation instance
	 */
	async chat(Conversation, allowSave=true, q){
		if(!Conversation)
			throw new Error('Conversation instance required')
		Conversation.processStartTime
		await mCallLLM(Conversation, allowSave, this.#llm, this.#factory, q) // mutates Conversation
		return Conversation
	}
	/**
	 * Initializes a conversation, currently only requested by System Avatar, but theoretically could be requested by any externally-facing Member Avatar as well. **note**: not in Q because it does not have a #botAgent yet.
	 * @param {String} type - The type of conversation, defaults to `chat`
	 * @param {String} form - The form of conversation, defaults to `system-avatar`
	 * @param {String} prompt - The prompt for the conversation (optional)
	 * @returns {Promise<Conversation>} - The Conversation instance
	 */
	async conversationStart(type='chat', form='system-avatar', prompt){
		const { avatar, } = this
		const { bot_id: _llm_id, id: bot_id, } = avatar
		let { llm_id=_llm_id, } = avatar // @stub - deprecate bot_id
		const Conversation = await mConversationStart(type, form, bot_id, null, llm_id, this.#llm, this.#factory, prompt)
		return Conversation
	}
    /**
     * Given an itemId, evaluates aspects of item summary. Evaluate content is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM.
     * @param {Guid} itemId - The item id
     * @returns {Object} - The Response object { instruction, responses, success, }
     */
	async evaluate(itemId){
        const response = await this.#factory.evaluate(itemId, this.avatar.llm_id)
		return response
	}
	/**
	 * Gets the correct bot for the item type and form.
	 * @todo - deprecate
	 * @param {String} itemForm - The item form
	 * @param {String} itemType - The item type
	 * @returns {String} - The assistant type
	 */
	getAssistantType(itemForm='biographer', itemType='memory'){
		if(itemType.toLowerCase()==='memory')
			return 'biographer'
		if(itemType.toLowerCase()==='entry')
			return itemForm.toLowerCase()==='diary'
				? 'diary'
				: 'journaler'
		return 'avatar'
	}
    /**
     * Get a static or dynamic greeting from active bot.
     * @param {boolean} dynamic - Whether to use LLM for greeting
     * @returns {String} - The greeting message from the active Bot
     */
    async greeting(dynamic=false){
        const greeting = await this.activeBot.greeting(dynamic)
        return greeting
    }
	/**
	 * Begins or continues a living memory conversation.
	 * @param {Object} item - Memory item from database
	 * @param {String} memberInput - The member input (with instructions)
	 * @param {Avatar} Avatar - The Avatar instance
	 * @returns {Object} - The living memory object
	 */
	async liveMemory(item, memberInput='NEXT', Avatar){
		const { biographer, } = this
		const livingMemory = Avatar.livingMemory
		let message = `## LIVE Memory Trigger\n`
		if(!livingMemory.id?.length){
			const { bot_id: _llm_id, id: bot_id, type, } = biographer
			const { llm_id=_llm_id, } = biographer
			const messages = []
			messages.push({
				content: `## MEMORY SUMMARY Reference for id: ${ item.id }\n### FOR REFERENCE ONLY\n${ item.summary }\n`,
				role: 'user',
			})
			memberInput = `${ message }Let's begin to LIVE MEMORY, id: ${ item.id }, MEMORY SUMMARY starts this conversation`
			const Conversation = await mConversationStart('memory', type, bot_id, null, llm_id, this.#llm, this.#factory, memberInput, messages)
			Conversation.action = 'living'
			livingMemory.Conversation = Conversation
			livingMemory.id = this.#factory.newGuid
			livingMemory.item = item
		}
		const { Conversation, } = livingMemory
		Conversation.prompt = memberInput?.trim()?.length
			? memberInput
			: message
		await mCallLLM(Conversation, false, this.#llm, this.#factory, Avatar)
		return livingMemory
	}
    /**
     * Migrates a bot to a new, presumed combined (with internal or external) bot.
     * @param {Guid} bot_id - The bot id
     * @returns {Promise<Bot>} - The migrated Bot instance
     */
    async migrateBot(bot_id){
		throw new Error('migrateBot() not yet implemented')
    }
    /**
     * Migrates a chat conversation from an old thread to a newly created (or identified) destination thread.
     * @param {Guid} bot_id - Bot id whose Conversation is to be migrated
     * @returns {Boolean} - Whether or not operation was successful
     */
    async migrateChat(bot_id){
		/* validate request */
		if(this.#factory.isMyLife)
			throw new Error('Chats with Q cannot be migrated.')
		const Bot = this.bot(bot_id)
		if(!Bot)
			return false
        /* execute request */
		await Bot.migrateChat() // no Conversation save
        /* respond request */
        return true
    }
	/**
	 * Sets the active bot for the BotAgent.
	 * @async
	 * @param {Guid} bot_id - The Bot id
	 * @param {Boolean} dynamic - Whether to use dynamic greetings, defaults to `false`
     * @returns {object} - Activated Response object: { bot_id, greeting, success, version, versionUpdate, }
	 */
	async setActiveBot(bot_id=this.avatar?.id, dynamic=false){
		let greeting,
			success=false,
			version=0.0,
			versionUpdate=0.0
		const Bot = this.#bots.find(bot=>bot.id===bot_id)
		success = !!Bot
		if(!success)
			return
		this.#activeBot = Bot
		dynamic = dynamic && !this.#factory.isMyLife
		if(this.#factory.isMyLife)
			bot_id = null
		else {
			const { id, type, version: versionCurrent, } = Bot
			bot_id = id
			version = versionCurrent
			versionUpdate = this.#factory.botInstructionsVersion(type)
		}
		greeting = await Bot.greeting(dynamic, `Greet member while thanking them for selecting you`)
		return {
			bot_id,
			greeting,
			success,
			version,
			versionUpdate,
		}
	}
	/**
	 * Sets the active team for the BotAgent if `teamId` valid.
	 * @param {Guid} teamId - The Team id
	 * @returns {void}
	 */
	setActiveTeam(teamId){
		this.#activeTeam = this.teams.find(team=>team.id===teamId)
			?? this.#activeTeam
	}
	/**
	 * Summarizes a file document.
	 * @param {String} fileId - The file id
	 * @param {String} fileName - The file name
	 * @param {Number} processStartTime - The process start time, defaults to `Date.now()`
	 * @param {Avatar} Avatar - The Avatar instance
	 * @returns {Promise<Messages[]>} - The array of messages to respond with
	 */
	async summarize(fileId, fileName, processStartTime=Date.now(), Avatar){
		if(!fileId?.length && !fileName?.length)
			return responses
		let prompts = []
		if(fileId?.length)
			prompts.push(`id=${ fileId }`)
		if(fileName?.length)
			prompts.push(`file-name=${ fileName }`)
		const prompt = `Summarize file document: ${ prompts.join(', ') }`
		if(!this.#fileConversation)
			this.#fileConversation = await this.conversationStart('file-summary', 'member-avatar', prompt, processStartTime)
		this.#fileConversation.prompt = prompt
		await mCallLLM(this.#fileConversation, false, this.#llm, this.#factory, Avatar)
		const responses = this.#fileConversation.getMessages()
        return responses
	}
	/**
	 * Updates a bot instance.
	 * @param {object} botData - The bot data to update
	 * @param {object} botOptions - Options for updating the bot
	 * @returns {Promise<Bot>} - The updated Bot instance
	 */
	async updateBot(botData, botOptions){
		const { id, } = botData
		if(!this.globals.isValidGuid(id))
			throw new Error('`id` parameter required')
		const Bot = this.#bots.find(bot=>bot.id===id)
		if(!Bot)
			throw new Error(`Bot not found with id: ${ id }`)
		await Bot.update(botData, botOptions)
		return Bot
	}
	/**
	 * Updates bot instructions and migrates thread by default.
	 * @param {Guid} bot_id - The bot id
	 * @param {Boolean} migrateThread - Whether to migrate the thread, defaults to `true`
	 * @returns {Bot} - The updated Bot instance
	 */
	async updateBotInstructions(bot_id, migrateThread=true){
		const Bot = this.bot(bot_id)
		const { type, version=1.0, } = Bot
        /* check version */
        const newestVersion = this.#factory.botInstructionsVersion(type)
        if(newestVersion!=version){
			const { bot_id: _llm_id, id, } = Bot
			const { llm_id=_llm_id, } = Bot
            const _bot = { id, llm_id, type, }
            const botOptions = {
                instructions: true,
                model: true,
                tools: true,
                vectorstoreId: this.#vectorstoreId,
            }
            await Bot.update(_bot, botOptions)
            if(migrateThread)
                if(!await Bot.migrateChat())
					console.log(`thread migration failed for bot: ${ bot_id }`)
        }
        return Bot
	}
    /* getters/setters */
	/**
	 * Gets the active Bot instance.
	 * @getter
	 * @returns {Bot} - The active Bot instance
	 */
	get activeBot(){
		return this.#activeBot
	}
	/**
	 * Gets the active team.
	 * @getter
	 * @returns {object} - The active team object
	 */
	get activeTeam(){
		return this.#activeTeam
	}
	/**
	 * Gets the active bot id for the BotAgent.
	 * @getter
	 * @returns {Guid} - The active bot id
	 */
	get activeBotId(){
		return this.#activeBot?.id
	}
	/**
	 * Gets the primary avatar for Member.
	 * @getter
	 * @returns {Bot} - The primary avatar Bot instance
	 */
	get avatar(){
		const Bot = this.#bots.find(Bot=>Bot.isAvatar===true)
		return Bot
	}
	/**
	 * Gets the Avatar id for whom this BotAgent is conscripted.
	 * @getter
	 * @returns {String} - The Avatar id
	 */
	get avatarId(){
		return this.#avatarId
	}
	/**
	 * Gets the Biographer bot for the BotAgent.
	 * @getter
	 * @returns {Bot} - The Biographer Bot instance
	 */
	get biographer(){
		const Biographer = this.#bots.find(bot=>bot.isBiographer)
		return Biographer
	}
	/**
	 * Gets the array of bots employed by this BotAgent.
	 * @getter
	 * @returns {Bot[]} - The array of bots
	 */
	get bots(){
		return this.#bots
	}
	/**
	 * Returns system globals object.
	 * @getter
	 * @returns {object} - System globals object
	 */
	get globals(){
		return this.#factory.globals
	}
	get greetings(){
		return this.#activeBot.greetings
	}
	/**
	 * Returns whether BotAgent is employed by MyLife (`true`) or Member (`false`).
	 * @getter
	 * @returns {Boolean} - Whether BotAgent is employed by MyLife, defaults to `false`
	 */
	get isMyLife(){
		return this.#factory.isMyLife
	}
	/**
	 * Retrieves list of available MyLife Teams.
	 * @getter
	 * @returns {object[]} - The array of MyLife Teams
	 */
	get teams(){
        return mTeams
	}
	/**
	 * Returns the Vectorstore id for the BotAgent.
	 * @getter
	 * @returns {String} - The Vectorstore id
	 */
	get vectorstoreId(){
		return this.#vectorstoreId
	}
}
/* modular functions */
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @module
 * @param {object} botData - The bot data object
 * @param {LLMServices} llm - OpenAI object
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(botData, llm){
    const { bot_name, type, } = botData
	botData.name = bot_name
		?? `_member_${ type }`
    const bot = await llm.createBot(botData)
	return bot
}
/**
 * Creates bot and returns associated `bot` object.
 * @todo - validBotData.name = botDbName should not be required, push logic to `llm-services`
 * @module
 * @async
 * @param {Guid} avatarId - The Avatar id
 * @param {String} vectorstore_id - The Vectorstore id
 * @param {Object} botData - The bot proto-data
 * @param {AgentFactory} factory - Agent Factory instance
 * @returns {Promise<Bot>} - Created Bot instance
*/
async function mBotCreate(avatarId, vectorstore_id, botData, llm, factory){
	/* validation */
	const { type, } = botData
	if(!avatarId?.length || !type?.length)
		throw new Error('avatar id and type required to create bot')
	const { greeting, greetings, instructions, version=1.0, } = mBotInstructions(factory, botData)
	const model = process.env.OPENAI_MODEL_CORE_BOT
		?? process.env.OPENAI_MODEL_CORE_AVATAR
		?? 'gpt-4o'
	const { tools, tool_resources, } = mGetAIFunctions(type, factory.globals, vectorstore_id)
	const id = factory.newGuid
    let {
        bot_name = `My ${type}`,
        description = `I am a ${type} for ${factory.memberName}`,
        name = `bot_${type}_${avatarId}`,
    } = botData
	const validBotData = {
		being: 'bot',
		bot_name,
		description,
		greeting,
		greetings,
		id,
		instructions,
		metadata: {
			externalId: id,
			version: version.toString(),
		},
		model,
		name,
		object_id: avatarId,
		provider: 'openai',
		purpose: description,
		tools,
		tool_resources,
		type,
		vectorstore_id,
		version,
	}
	/* create in LLM */
	const { id: llm_id, thread_id, } = await mBotCreateLLM(validBotData, llm)
	if(!llm_id?.length)
		throw new Error('bot creation failed')
	/* create in MyLife datastore */
	validBotData.llm_id = llm_id
	validBotData.thread_id = thread_id
	botData = await factory.createBot(validBotData) // repurposed incoming botData
	const _Bot = new Bot(botData, llm, factory)
	console.log(`bot created::${ type }`, _Bot.thread_id, _Bot.id, _Bot.bot_id, _Bot.bot_name )
	return _Bot
}
/**
 * Creates bot and returns associated `bot` object.
 * @module
 * @param {object} botData - Bot object
 * @param {LLMServices} llm - OpenAI object
 * @returns {string} - Bot assistant id in openAI
*/
async function mBotCreateLLM(botData, llm){
    const { id, thread_id, } = await mAI_openai(botData, llm)
    return {
		id,
		thread_id,
	}
}
/**
 * Deletes the bot requested from avatar memory and from all long-term storage.
 * @param {Guid} bot_id - The bot id to delete
 * @param {BotAgent} BotAgent - BotAgent instance
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - The Factory instance
 * @returns {Promise<Boolean>} - Whether or not operation was successful
 */
async function mBotDelete(bot_id, BotAgent, llm, factory){
	const Bot = BotAgent.bot(bot_id)
	const { bot_id: _llm_id, id, type, thread_id, } = Bot
	const { llm_id=_llm_id, } = Bot
    const cannotRetire = ['actor', 'system', 'personal-avatar']
    if(cannotRetire.includes(type))
        return false
    /* delete from memory */
	const { bots, } = BotAgent
	const botIndex = bots.findIndex(bot=>bot.id===id)
    bots.splice(botIndex, 1)
    /* delete bot from Cosmos */
    await factory.deleteItem(id)
    /* delete thread and bot from LLM */
	if(llm_id?.length)
    	await llm.deleteBot(llm_id)
	if(thread_id?.length)
	    await llm.deleteThread(thread_id)
	return true
}
/**
 * Returns set of dynamically generated Greeting messages.
 * @module
 * @param {String} thread_id - The thread id
 * @param {Guid} llm_id - The bot id
 * @param {String} greetingPrompt - The prompt for the greeting
 * @param {LLMServices} llm - OpenAI object
 * @param {AgentFactory} factory - Agent Factory object
 * @returns {Promise<Array>} - The array of string messages to respond with
 */
async function mBotGreetings(thread_id, llm_id, greetingPrompt=`Greet me enthusiastically`, llm, factory){
	let responses = await llm.getLLMResponse(thread_id, llm_id, greetingPrompt, factory)
		?? [mDefaultGreetings]
	responses = llm.extractResponses(responses)
    return responses
}
/**
 * Returns MyLife-version of bot instructions.
 * @module
 * @param {AgentFactory} factory - The Factory instance
 * @param {Object} botData - The bot proto-data
 * @returns {object} - The intermediary bot instructions object: { instructions, version, }
 */
function mBotInstructions(factory, botData={}){
	const { type=mDefaultBotType, } = botData
    let {
		greeting,
		greetings,
		instructions,
		limit=8000,
		version,
	} = factory.botInstructions(type)
		?? {}
    if(!instructions) // @stub - custom must have instruction loophole
		throw new Error(`bot instructions not found for type: ${ type }`)
    let {
		general,
		purpose='',
		preamble='',
		prefix='',
		references=[],
		replacements=[],
		suffix='', // example: data privacy info
		voice='',
	} = instructions
    /* compile instructions */
    switch(type){
		case 'avatar':
        case 'personal-avatar':
            instructions = preamble
                + general
            break
		case 'biographer':
        case 'journaler':
		case 'personal-biographer':
            instructions = preamble
                + purpose
                + prefix
                + general
				+ voice
            break
		case 'diary':
            instructions = purpose
				+ preamble
				+ prefix
                + general
				+ suffix
				+ voice
			break
        default:
            instructions = general
            break
    }
	/* greetings */
	greetings = greetings
		?? [greeting]
    /* apply replacements */
    replacements.forEach(replacement=>{
        const placeholderRegExp = factory.globals.getRegExp(replacement.name, true)
        const replacementText = eval(`botData?.${replacement.replacement}`)
			?? eval(`factory?.${replacement.replacement}`)
            ?? eval(`factory.core?.${replacement.replacement}`)
            ?? replacement?.default
            ?? '`unknown-value`'
        instructions = instructions.replace(placeholderRegExp, _=>replacementText)
		greetings = greetings.map(greeting=>greeting.replace(placeholderRegExp, _=>replacementText))
    })
    /* apply references */
    references.forEach(_reference=>{
        const _referenceText = _reference.insert
        const replacementText = eval(`factory?.${_reference.value}`)
            ?? eval(`botData?.${_reference.value}`)
            ?? _reference.default
            ?? '`unknown-value`'
        switch(_reference.method ?? 'replace'){
            case 'append-hard':
                const _indexHard = instructions.indexOf(_referenceText)
                if (_indexHard !== -1) {
                instructions =
                    instructions.slice(0, _indexHard + _referenceText.length)
                    + '\n'
                    + replacementText
                    + instructions.slice(_indexHard + _referenceText.length)
                }
                break
            case 'append-soft':
                const _indexSoft = instructions.indexOf(_referenceText);
                if (_indexSoft !== -1) {
                instructions =
                      instructions.slice(0, _indexSoft + _referenceText.length)
                    + ' '
                    + replacementText
                    + instructions.slice(_indexSoft + _referenceText.length)
                }
                break
            case 'replace':
            default:
                instructions = instructions.replace(_referenceText, replacementText)
                break
        }
    })
	const response = {
		greetings,
		instructions,
		version,
	}
	return response
}
/**
 * Updates bot in Cosmos, and if necessary, in LLM. Returns unsanitized bot data document.
 * @module
 * @param {object} botData - Bot data update object
 * @param {object} options - Options object: { instructions: boolean, model: boolean, tools: boolean, vectorstoreId: string, }
 * @param {Bot} Bot - The Bot instance
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - Factory instance
 * @returns {Promise<Object>} - Allowed (and written) bot data object (dynamic construction): { id, type, ...anyNonRequired }
 */
async function mBotUpdate(botData, options={}, Bot, llm, factory){
	/* validate request */
	if(!Bot)
		throw new Error('Bot instance required to update bot')
	const { bot_id, id, llm_id, metadata={}, type, vectorstoreId: bot_vectorstore_id, } = Bot
	const _llm_id = llm_id
		?? bot_id // @stub - deprecate bot_id
	const {
		instructions: discardInstructions,
		mbr_id, // no modifications allowed
		name, // no modifications allowed
		tools: discardTools,
		tool_resources: discardResources,
		...allowedBotData
	} = botData
	const {
		instructions: updateInstructions=false,
		model: updateModel=false,
		tools: updateTools=false,
		vectorstoreId=bot_vectorstore_id,
	} = options
	if(updateInstructions){
		const instructionReferences = { ...Bot.instructionNodeValues, ...allowedBotData }
		const { instructions, version=1.0, } = mBotInstructions(factory, instructionReferences)
		allowedBotData.instructions = instructions
		allowedBotData.metadata = metadata
		allowedBotData.metadata.version = version.toString()
		allowedBotData.version = version /* omitted from llm, but appears on updateBot */
	}
	if(updateTools){
		const { tools, tool_resources, } = mGetAIFunctions(type, factory.globals, vectorstoreId)
		allowedBotData.tools = tools
		allowedBotData.tool_resources = tool_resources
	}
	if(updateModel)
		allowedBotData.model = factory.globals.currentOpenAIBotModel
	allowedBotData.id = id
	allowedBotData.type = type
	/* execute request */
	if(_llm_id?.length && (allowedBotData.instructions || allowedBotData.bot_name?.length || allowedBotData.tools)){
		allowedBotData.model = factory.globals.currentOpenAIBotModel // not dynamic
		allowedBotData.llm_id = _llm_id
		await llm.updateBot(allowedBotData)
	}
	await factory.updateBot(allowedBotData)
	return allowedBotData
}
/**
 * Sends Conversation instance with prompts for LLM to process, updating the Conversation instance before returning `void`.
 * @todo - create actor-bot for internal chat? Concern is that API-assistants are only a storage vehicle, ergo not an embedded fine tune as I thought (i.e., there still may be room for new fine-tuning exercise); i.e., micro-instructionsets need to be developed for most. Unclear if direct thread/message instructions override or ADD, could check documentation or gpt, but...
 * @todo - would dynamic event dialog be handled more effectively with a callback routine function, I think so, and would still allow for avatar to vet, etc.
 * @module
 * @param {Conversation} Conversation - Conversation instance
 * @param {boolean} allowSave - Whether to save the conversation, defaults to `true`
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - Agent Factory object required for function execution
 * @param {object} avatar - Avatar object
 * @returns {Promise<void>} - Alters Conversation instance by nature
 */
async function mCallLLM(Conversation, allowSave=true, llm, factory, avatar){
    const { llm_id, originalPrompt, processStartTime=Date.now(), prompt, thread_id, } = Conversation
	if(!llm_id?.length)
		throw new Error('No `llm_id` intelligence id found in Conversation for `mCallLLM`.')
    if(!thread_id?.length)
        throw new Error('No `thread_id` found in Conversation for `mCallLLM`.')
	if(!prompt?.length)
		throw new Error('No `prompt` found in Conversation for `mCallLLM`.')
    const botResponses = await llm.getLLMResponse(thread_id, llm_id, prompt, factory, avatar)
	if(!botResponses?.length)
		return
	const { run_id, } = botResponses[0]
	Conversation.addRun(run_id)
    botResponses
		.filter(botResponse=>botResponse?.run_id===Conversation.run_id)
		.sort((mA, mB)=>(mB.created_at-mA.created_at))
	Conversation.addMessage({
		content: prompt,
		created_at: processStartTime,
		originalPrompt,
		role: 'member',
		run_id,
		thread_id,
	})
	Conversation.addMessages(botResponses)
	if(allowSave)
		Conversation.save() // no `await`
}
/**
 * Deletes conversation and updates 
 * @param {Conversation} Conversation - The Conversation instance
 * @param {LLMServices} llm - The LLMServices instance
 * @returns {Promise<boolean>} - `true` if successful
 */
async function mConversationDelete(Conversation, factory, llm){
    /* delete thread_id from bot and save to Cosmos */
    Bot.thread_id = ''
    const { id, thread_id, } = Bot
    factory.updateBot({
        id,
        thread_id,
    })
    await factory.deleteItem(Conversation.id) /* delete conversation from Cosmos */
    await llm.deleteThread(thread_id) /* delete thread from LLM */
    return true
}
/**
 * Create a new conversation.
 * @async
 * @module
 * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, system, etc.; defaults to `chat`
 * @param {string} form - Form of conversation: system-avatar, member-avatar, etc.; defaults to `system-avatar`
 * @param {string} thread_id - The openai thread id
 * @param {string} llm_id - The id for the llm agent
 * @param {LLMServices} llm - The LLMServices instance
 * @param {AgentFactory} factory - Agent Factory object
 * @param {string} prompt - The prompt for the conversation (optional)
 * @param {Message[]} messages - The array of messages to seed the conversation
 * @returns {Conversation} - The conversation object
 */
async function mConversationStart(type='chat', form='system', bot_id, thread_id, llm_id, llm, factory, prompt, messages){
	const { mbr_id, newGuid: id, } = factory
	const metadata = { bot_id, conversation_id: id, mbr_id, },
		processStartTime = Date.now(),
		thread = await mThread(llm, thread_id, messages, metadata)
	const Conversation = new (factory.conversation)(
		{
			form,
			id,
			mbr_id,
			prompt,
			processStartTime,
			type,
		},
		factory,
		bot_id,
		llm_id,
		thread
	)
	return Conversation
}
/**
 * Retrieves any functions that need to be attached to the specific bot-type.
 * @module
 * @todo - Move to llmServices and improve
 * @param {string} type - Type of bot.
 * @param {object} globals - Global functions for bot.
 * @param {string} vectorstoreId - Vectorstore id.
 * @returns {object} - OpenAI-ready object for functions { tools, tool_resources, }.
 */
function mGetAIFunctions(type, globals, vectorstoreId){
	let includeSearch=false,
		tool_resources,
		tools = []
	switch(type){
		case 'assistant':
		case 'avatar':
		case 'personal-assistant':
		case 'personal-avatar':
			includeSearch = true
			break
		case 'biographer':
		case 'personal-biographer':
			tools.push(
				globals.getGPTJavascriptFunction('changeTitle'),
				globals.getGPTJavascriptFunction('endReliving'),
				globals.getGPTJavascriptFunction('getSummary'),
				globals.getGPTJavascriptFunction('itemSummary'),
				globals.getGPTJavascriptFunction('updateSummary'),
			)
			includeSearch = true
			break
		case 'custom':
			includeSearch = true
			break
		case 'diary':
		case 'journaler':
			tools.push(
				globals.getGPTJavascriptFunction('changeTitle'),
				globals.getGPTJavascriptFunction('getSummary'),
				globals.getGPTJavascriptFunction('itemSummary'),
				globals.getGPTJavascriptFunction('obscure'),
				globals.getGPTJavascriptFunction('updateSummary'),
			)
			includeSearch = true
			break
		default:
			break
	}
	if(includeSearch){
		const { tool_resources: gptResources, tools: gptTools, } = mGetGPTResources(globals, 'file_search', vectorstoreId)
		tools.push(...gptTools)
		tool_resources = gptResources
	}
	return {
		tools,
		tool_resources,
	}
}
/**
 * Retrieves bot types based on team name and MyLife status.
 * @modular
 * @param {Boolean} isMyLife - Whether request is coming from MyLife Q AVatar
 * @param {*} teamName - The team name, defaults to `mDefaultTeam`
 * @returns {String[]} - The array of bot types
 */
function mGetBotTypes(isMyLife=false, teamName=mDefaultTeam){
	const team = mTeams
		.find(team=>team.name===teamName)
	const botTypes = [...mRequiredBotTypes, ...isMyLife ? [] : team?.defaultTypes ?? []]
	return botTypes
}
/**
 * Retrieves any tools and tool-resources that need to be attached to the specific bot-type.
 * @param {Globals} globals - Globals object.
 * @param {string} toolName - Name of tool.
 * @param {string} vectorstoreId - Vectorstore id.
 * @returns {object} - { tools, tool_resources, }.
 */
function mGetGPTResources(globals, toolName, vectorstoreId){
	switch(toolName){
		case 'file_search':
			const { tools, tool_resources, } = globals.getGPTFileSearchToolStructure(vectorstoreId)
			return { tools, tool_resources, }
		default:
			throw new Error('tool name not recognized')
	}
}
/**
 * Initializes the provided BotAgent instance.
 * @async
 * @module
 * @param {BotAgent} BotAgent - The BotAgent to initialize
 * @param {Bot[]} bots - The array of bots (empty on init)
 * @param {AgentFactory} factory - The factory instance
 * @param {LLMServices} llm - The LLMServices instance
 * @returns {void}
 */
async function mInit(BotAgent, bots, factory, llm){
	const { avatarId, vectorstoreId, } = BotAgent
	bots.push(...await mInitBots(avatarId, vectorstoreId, factory, llm))
	BotAgent.setActiveBot(null, false)
}
/**
 * Initializes active bots based upon criteria.
 * @param {Guid} avatarId - The Avatar id
 * @param {String} vectorstore_id - The Vectorstore id
 * @param {AgentFactory} factory - The MyLife factory instance
 * @param {LLMServices} llm - The LLMServices instance
 * @returns {Bot[]} - The array of activated and available bots
 */
async function mInitBots(avatarId, vectorstore_id, factory, llm){
	const bots = ( await factory.bots(avatarId) )
		.map(botData=>{
			botData.vectorstore_id = vectorstore_id
			botData.object_id = avatarId
			return new Bot(botData, llm, factory)
		})
	return bots
}
/**
 * Migrates LLM thread/memory to new one, altering Conversation instance when available.
 * @param {Bot} Bot - Bot instance
 * @param {LLMServices} llm - The LLMServices instance
 * @param {Boolean} saveConversation - Whether to save the conversation immediately, defaults to `false`
 * @returns {Promise<Boolean>} - Whether or not operation was successful
 */
async function mMigrateChat(Bot, llm, saveConversation=false){
    /* constants and variables */
	const { conversation, id: bot_id, thread_id, type: botType, } = Bot
	if(!thread_id?.length)
		return false
    let messages = await llm.messages(thread_id) // @todo - limit to 25 messages or modify request
    if(!messages?.length)
        return false
    let chatLimit=25,
		disclaimer=`INFORMATIONAL ONLY **DO NOT PROCESS**\n`,
        itemCollectionTypes='item',
        itemLimit=100,
        type='item'
    switch(botType){
        case 'biographer':
        case 'personal-biographer':
            type = 'memory'
            itemCollectionTypes = `memory,story,narrative`
            break
        case 'diary':
        case 'journal':
        case 'journaler':
            type = 'entry'
            const itemType = botType==='journaler'
                ? 'journal'
                : botType
            itemCollectionTypes = `${ itemType },entry,`
            break
        default:
            break
    }
    const chatSummary=`## ${ type.toUpperCase() } CHAT SUMMARY\n`,
        chatSummaryRegex = /^## [^\n]* CHAT SUMMARY\n/,
        itemSummary=`## ${ type.toUpperCase() } LIST\n`,
        itemSummaryRegex = /^## [^\n]* LIST\n/
    const items = ( await Bot.collections(type) )
        .sort((a, b)=>a._ts-b._ts)
        .slice(0, itemLimit)
    const itemList = items
        .map(item=>`- itemId: ${ item.id } :: ${ item.title }`)
        .join('\n')
    const itemCollectionList = items
        .map(item=>item.id)
        .join(',')
        .slice(0, 512) // limit for metadata string field
    const metadata = {
        bot_id: bot_id,
    }
    /* prune messages source material */
    messages = messages
        .slice(0, chatLimit)
        .map(message=>{
            const { content: contentArray, id, metadata, role, } = message
            const content = contentArray
                .filter(_content=>_content.type==='text')
                .map(_content=>_content.text?.value)
                ?.[0]
            return { content, id, metadata, role, }
        })
        .filter(message=>!itemSummaryRegex.test(message.content))
    const summaryMessage = messages
        .filter(message=>!chatSummaryRegex.test(message.content))
        .map(message=>message.content)
        .join('\n')
    /* contextualize previous content */
    const summaryMessages = []
    /* summary of items */
    if(items.length)
        summaryMessages.push({
            content: itemSummary + disclaimer + itemList,
            metadata: {
                collectionList: itemCollectionList,
                collectiontypes: itemCollectionTypes,
            },
            role: 'assistant',
        })
    /* summary of messages */
    if(summaryMessage.length)
        summaryMessages.push({
            content: chatSummary + disclaimer + summaryMessage,
            metadata: {
                collectiontypes: itemCollectionTypes,
            },
            role: 'assistant',
        })
    if(!summaryMessages.length)
        return
    /* add messages to new thread */
	const newThread = await mThread(llm, null, summaryMessages.reverse(), metadata)
	if(!!conversation){
	    conversation.setThread(newThread)
		if(saveConversation)
			conversation.save() // no `await`
	}
    await Bot.setThread(newThread.id) // autosaves `thread_id`, no `await`
}
/**
 * Gets or creates a new thread in LLM provider.
 * @param {LLMServices} llm - The LLMServices instance
 * @param {String} thread_id - The thread id (optional)
 * @param {Messages[]} messages - The array of messages to seed the thread (optional)
 * @param {Object} metadata - The metadata object (optional)
 * @returns {Promise<Object>} - The thread object
 */
async function mThread(llm, thread_id, messages, metadata){
	const thread = await llm.thread(thread_id, messages, metadata)
	return thread
}
/* exports */
export default BotAgent