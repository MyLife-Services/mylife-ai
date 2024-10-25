/* module constants */
const mBot_idOverride = process.env.OPENAI_MAHT_GPT_OVERRIDE
const mDefaultBotTypeArray = ['personal-avatar', 'avatar']
const mDefaultBotType = mDefaultBotTypeArray[0]
const mDefaultGreetings = []
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
	#llm
	constructor(botData, llm, factory){
		this.#factory = factory
		this.#llm = llm
		botData = this.globals.sanitize(botData)
		Object.assign(this, botData)
		if(!this.id)
			throw new Error('Bot database id required')
		// @stub - this.#collectionsAgent = new CollectionsAgent(llm, factory)
	}
	/* public functions */
	/**
	 * Chat with the active bot.
	 * @param {String} message - The member request
	 * @param {String} originalMessage - The original message
	 * @param {Boolean} allowSave - Whether to save the conversation, defaults to `true`
	 * @param {Number} processStartTime - The process start time
	 * @returns {Promise<Conversation>} - The Conversation instance updated with the chat exchange
	 */
	async chat(message, originalMessage, allowSave=true, processStartTime=Date.now()){
		if(this.isMyLife && !this.isAvatar)
			throw new Error('Only Q, MyLife Corporate Intelligence, is available for non-member conversation.')
		const Conversation = await this.getConversation()
		Conversation.prompt = message
		Conversation.originalPrompt = originalMessage
		await mCallLLM(Conversation, allowSave, this.#llm, this.#factory, this) // mutates Conversation
        /* frontend mutations */
		return Conversation
	}
	/**
	 * Retrieves `this` Bot instance.
	 * @returns {Bot} - The Bot instance
	 */
	getBot(){
		return this
	}
	/**
	 * Retrieves the Conversation instance for this bot.
	 * @param {String} message - The member request (optional)
	 * @returns {Promise<Conversation>} - The Conversation instance
	 */
	async getConversation(message){
		if(!this.#conversation){
			const { bot_id: _llm_id, id: bot_id, thread_id, type, } = this
			let { llm_id=_llm_id, } = this // @stub - deprecate bot_id
			this.#conversation = await mConversationStart('chat', type, bot_id, thread_id, llm_id, this.#llm, this.#factory, message)
		}
		return this.#conversation
	}
	/**
	 * Retrieves a greeting message from the active bot.
	 * @param {Boolean} dynamic - Whether to use dynamic greetings (`true`) or static (`false`)
	 * @param {LLMServices} llm - OpenAI object
	 * @param {AgentFactory} factory - Agent Factory object
	 * @returns {Array} - The greeting message(s) string array in order of display
	 */
	async getGreeting(dynamic=false, llm, factory){
		const greetings =  await mBotGreeting(dynamic, this, llm, factory)
		return greetings
	}
    /**
     * Migrates Conversation from an old thread to a newly created (or identified) destination thread.
     * @returns {Boolean} - Whether or not operation was successful
     */
	async migrateChat(){
		const migration = mMigrateChat(this, this.#llm, this.#factory)
		return !!migration
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
	 * @returns 
	 */
	async update(botData, botOptions){
		/* validate request */
		this.globals.sanitize(botData)
		const Bot = await mBotUpdate(this.#factory, this.#llm, botData, botOptions)
		return this.globals.sanitize(Bot)
	}
	async save(){

	}
	/**
	 * Sets the thread id for the bot.
	 * @param {String} thread_id - The thread id
	 * @returns {Promise<void>}
	 */
	async setThread(thread_id){
		const llm_id = this.llm_id
			?? this.bot_id
		if(!thread_id?.length)
			thread_id = await this.#llm.createThread(llm_id)
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
	 * Gets the frontend bot object. If full instance is required, use `getBot()`.
	 * @getter
	 */
	get bot() {
		const { bot_name, description, id, purpose, type, version } = this
		const bot = {
			bot_name,
			description,
			id,
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
	get isAvatar(){
		return mDefaultBotTypeArray.includes(this.type)
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
		if(!this.#factory.isMyLife)
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
     * Get a static or dynamic greeting from active bot.
     * @param {boolean} dynamic - Whether to use LLM for greeting
     * @returns {Messages[]} - The greeting message(s) string array in order of display
     */
    async greeting(dynamic=false){
        const greetings = await this.activeBot.getGreeting(dynamic, this.#llm, this.#factory)
        return greetings
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
		await Bot.migrateChat()
        /* respond request */
        return true
    }
	/**
	 * Sets the active bot for the BotAgent.
	 * @param {Guid} bot_id - The Bot id
	 * @returns {void}
	 */
	setActiveBot(bot_id=this.avatar?.id){
		const Bot = this.#bots.find(bot=>bot.id===bot_id)
		if(Bot)
			this.#activeBot = Bot
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
	async summarize(fileId, fileName, processStartTime=Date.now()){
		let responses = []
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
		responses = await mCallLLM(this.#fileConversation, false, this.#llm, this.#factory)
        return responses
	}
	/**
	 * Updates a bot instance.
	 * @param {object} botData - The bot data to update
	 * @param {object} botOptions - Options for updating the bot
	 * @returns {Promise<Bot>} - The updated Bot instance
	 */
	async updateBot(botData, botOptions={}){
		const { id, } = botData
		if(!this.globals.isValidGuid(id))
			throw new Error('`id` parameter required')
		const Bot = this.#bots.find(bot=>bot.id===id)
		if(!!Bot)
			throw new Error(`Bot not found with id: ${ id }`)
		Bot.update(botData, botOptions)
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
 * Validates and cleans bot object then updates or creates bot (defaults to new personal-avatar) in Cosmos and returns successful `bot` object, complete with conversation (including thread/thread_id in avatar) and gpt-assistant intelligence.
 * @todo Fix occasions where there will be no object_id property to use, as it was created through a hydration method based on API usage, so will be attached to mbr_id, but NOT avatar.id
 * @todo - Turn this into Bot class
 * @module
 * @param {Guid} avatarId - The Avatar id
 * @param {string} vectorstore_id - The Vectorstore id
 * @param {AgentFactory} factory - Agent Factory instance
 * @param {Avatar} avatar - Avatar object that will govern bot
 * @param {object} botData - Bot data object, can be incomplete (such as update)
 * @returns {Promise<Bot>} - Bot object
 */
async function mBot(avatarId, vectorstore_id, factory, botData){
    /* validation */
    const { globals, isMyLife, mbr_id, newGuid, } = factory
    const { id=newGuid, type, } = botData
	console.log('BotAgent::mBot', avatarId, vectorstore_id, id, type, isMyLife)
	throw new Error('mBot() not yet implemented')
    if(!botType?.length)
        throw new Error('Bot type required to create.')
    bot.mbr_id = mbr_id /* constant */
    bot.object_id = objectId
        ?? avatarId /* all your bots belong to me */
    bot.id =  botId // **note**: _this_ is a Cosmos id, not an openAI id
    let originBot = avatar.bots.find(oBot=>oBot.id===botId)
    if(originBot){ /* update bot */
        const options = {}
        const updatedBot = Object.keys(bot)
            .reduce((diff, key) => {
                if(bot[key]!==originBot[key])
                    diff[key] = bot[key]
                return diff
            }, {})
        /* create or update bot special properties */
        const { thread_id, type, } = originBot // @stub - `bot_id` cannot be updated through this mechanic
        if(!thread_id?.length && !avatar.isMyLife){
            const excludeTypes = ['collection', 'library', 'custom'] // @stub - custom mechanic?
            if(!excludeTypes.includes(type)){
                const conversation = avatar.conversation(null, botId)
                    ?? await avatar.createConversation('chat', null, botId)
                updatedBot.thread_id = conversation.thread_id // triggers `factory.updateBot()`
                console.log('Avatar::mBot::conversation created given NO thread_id', updatedBot.thread_id, conversation.inspect(true))
            }
        }
        let updatedOriginBot
        if(Object.keys(updatedBot).length){
            updatedOriginBot = {...originBot, ...updatedBot} // consolidated update
            const { bot_id, id, } = updatedOriginBot
            updatedBot.bot_id = bot_id
            updatedBot.id = id
            updatedBot.type = type
            const { interests, } = updatedBot
            /* set options */
            if(interests?.length){
                options.instructions = true
                options.model = true
                options.tools = false /* tools not updated through this mechanic */
            }
            updatedOriginBot = await factory.updateBot(updatedBot, options)
        }
        originBot = mSanitize(updatedOriginBot ?? originBot)
        avatar.bots[avatar.bots.findIndex(oBot=>oBot.id===botId)] = originBot
    } else { /* create assistant */
        bot = mSanitize( await factory.createBot(bot, vectorstore_id) )
        avatar.bots.push(bot)
    }
    return originBot
        ?? bot
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
	const { instructions, version=1.0, } = mBotInstructions(factory, type)
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
	const { id: bot_id, thread_id, } = await mBotCreateLLM(validBotData, llm)
	if(!bot_id?.length)
		throw new Error('bot creation failed')
	/* create in MyLife datastore */
	validBotData.bot_id = bot_id
	validBotData.thread_id = thread_id
	botData = await factory.createBot(validBotData) // repurposed incoming botData
	const Bot = new Bot(botData, llm, factory)
	console.log(chalk.green(`bot created::${ type }`), Bot.thread_id, Bot.id, Bot.bot_id, Bot.bot_name )
	return Bot
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
	const { id, llm_id, type, thread_id, } = Bot
    const cannotRetire = ['actor', 'system', 'personal-avatar']
    if(cannotRetire.includes(type))
        return false
    /* delete from memory */
	const { bots, } = BotAgent
	const botIndex = bots.findIndex(bot=>bot.id===id)
    bots.splice(botIndex, 1)
    /* delete bot from Cosmos */
    factory.deleteItem(id)
    /* delete thread and bot from LLM */
    llm.deleteBot(llm_id)
    llm.deleteThread(thread_id)
	return true
}
/**
 * Returns set of Greeting messages, dynamic or static
 * @param {boolean} dynamic - Whether to use dynamic greetings
 * @param {Bot} Bot - The bot instance
 * @param {LLMServices} llm - OpenAI object
 * @param {AgentFactory} factory - Agent Factory object
 * @returns {Promise<Message[]>} - The array of messages to respond with
 */
async function mBotGreeting(dynamic=false, Bot, llm, factory){
    const { bot_id, bot_name, id, greetings=[], greeting, thread_id, } = Bot
    const failGreetings = [
		`Hello! I'm concerned that there is something wrong with my instruction-set, as I was unable to find my greetings, but let's see if I can get back online.`,
		`How can I be of help today?`
	]
	const greetingPrompt = factory.isMyLife
		? `Greet this new visitor and let them know that you are here to help them understand MyLife and the MyLife platform. Begin by asking them about something that's important to them so I can demonstrate how MyLife will assist.`
		: `Where did we leave off, or how do we start?`
    const botGreetings = greetings?.length
        ? greetings
        : greeting
            ? [greeting]
            : failGreetings
    let messages = !dynamic
        ? botGreetings
        : await llm.getLLMResponse(thread_id, bot_id, greetingPrompt, factory)
    if(!messages?.length)
        messages = failGreetings
    messages = messages
        .map(message=>new (factory.message)({
            being: 'message',
            content: message,
            thread_id,
            role: 'assistant',
            type: 'greeting'
        }))
    return messages
}
/**
 * Returns MyLife-version of bot instructions.
 * @module
 * @param {AgentFactory} factory - The Factory instance
 * @param {String} type - The type of Bot to create
 * @returns {object} - The intermediary bot instructions object: { instructions, version, }
 */
function mBotInstructions(factory, type=mDefaultBotType){
    let {
		instructions,
		limit=8000,
		version,
	} = factory.botInstructions(type) ?? {}
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
		case 'diary':
            instructions = purpose
				+ preamble
				+ prefix
                + general
				+ suffix
				+ voice
			break
        case 'personal-avatar':
            instructions = preamble
                + general
            break
        case 'journaler':
		case 'personal-biographer':
            instructions = preamble
                + purpose
                + prefix
                + general
            break
        default:
            instructions = general
            break
    }
    /* apply replacements */
    replacements.forEach(replacement=>{
        const placeholderRegExp = factory.globals.getRegExp(replacement.name, true)
        const replacementText = eval(`bot?.${replacement.replacement}`)
			?? eval(`factory?.${replacement.replacement}`)
            ?? eval(`factory.core?.${replacement.replacement}`)
            ?? replacement?.default
            ?? '`unknown-value`'
        instructions = instructions.replace(placeholderRegExp, _=>replacementText)
    })
    /* apply references */
    references.forEach(_reference=>{
        const _referenceText = _reference.insert
        const replacementText = eval(`factory?.${_reference.value}`)
            ?? eval(`bot?.${_reference.value}`)
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
		instructions,
		version,
	}
	return response
}
/**
 * Updates bot in Cosmos, and if necessary, in LLM. Returns unsanitized bot data document.
 * @param {AgentFactory} factory - Factory object
 * @param {LLMServices} llm - The LLMServices instance
 * @param {object} bot - Bot object, winnow via mBot in `mylife-avatar.mjs` to only updated fields
 * @param {object} options - Options object: { instructions: boolean, model: boolean, tools: boolean, vectorstoreId: string, }
 * @returns 
 */
async function mBotUpdate(factory, llm, bot, options={}){
	/* constants */
	const {
		id, // no modifications
		instructions: removeInstructions,
		tools: removeTools,
		tool_resources: removeResources,
		type, // no modifications
		...botData // extract member-driven bot data
	} = bot
	const {
		instructions: updateInstructions=false,
		model: updateModel=false,
		tools: updateTools=false,
		vectorstoreId,
	} = options
	if(!factory.globals.isValidGuid(id))
		throw new Error('bot `id` required in bot argument: `{ id: guid }`')
	if(updateInstructions){
		const { instructions, version=1.0, } = mBotInstructions(factory, bot)
		botData.instructions = instructions
		botData.metadata = botData.metadata ?? {}
		botData.metadata.version = version.toString()
		botData.version = version /* omitted from llm, but appears on updateBot */
	}
	if(updateTools){
		const { tools, tool_resources, } = mGetAIFunctions(type, factory.globals, vectorstoreId)
		botData.tools = tools
		botData.tool_resources = tool_resources
	}
	if(updateModel)
		botData.model = factory.globals.currentOpenAIBotModel
	botData.id = id // validated
	/* LLM updates */
	const { bot_id, bot_name: name, instructions, tools, } = botData
	let { llm_id=bot_id, } = botData
	if(llm_id?.length && (instructions || name || tools)){
		botData.model = factory.globals.currentOpenAIBotModel // not dynamic
		botData.llm_id = llm_id
		await llm.updateBot(botData)
		const updatedLLMFields = Object.keys(botData)
			.filter(key=>key!=='id' && key!=='bot_id') // strip mechanicals
		console.log(chalk.green('mUpdateBot()::update in OpenAI'), id, llm_id, updatedLLMFields)
	}
	botData = await factory.updateBot(botData)
	return botData
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
    const { llm_id, originalPrompt, processStartTime=Date.now(), prompt, thread_id,  } = Conversation
	console.log('mCallLLM', llm_id, thread_id, prompt, processStartTime)
	if(!llm_id?.length)
		throw new Error('No `llm_id` intelligence id found in Conversation for `mCallLLM`.')
    if(!thread_id?.length)
        throw new Error('No `thread_id` found in Conversation for `mCallLLM`.')
	if(!prompt?.length)
		throw new Error('No `prompt` found in Conversation for `mCallLLM`.')
    const botResponses = await llm.getLLMResponse(thread_id, llm_id, prompt, factory, avatar)
	const run_id = botResponses?.[0]?.run_id
	if(!run_id?.length)
		return
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
    console.log('mDeleteConversation', Conversation.id, thread_id)
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
 * @param {number} processStartTime - The time the processing started, defaults to `Date.now()`
 * @returns {Conversation} - The conversation object
 */
async function mConversationStart(type='chat', form='system', bot_id, thread_id, llm_id, llm, factory, prompt, processStartTime=Date.now()){
	const { mbr_id, newGuid: id, } = factory
	const thread = await mThread(thread_id, llm)
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
				globals.getGPTJavascriptFunction('getSummary'),
				globals.getGPTJavascriptFunction('storySummary'),
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
				globals.getGPTJavascriptFunction('entrySummary'),
				globals.getGPTJavascriptFunction('getSummary'),
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
	BotAgent.setActiveBot()
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
 * Migrates LLM thread/memory to new one, altering Conversation instance.
 * @param {Bot} Bot - Bot instance
 * @param {LLMServices} llm - The LLMServices instance
 * @returns {Promise<Boolean>} - Whether or not operation was successful
 */
async function mMigrateChat(Bot, llm){
    /* constants and variables */
	const { Conversation, id: bot_id, type: botType, } = Bot
	if(!Conversation)
		return false
    const { chatLimit=25, thread_id, } = Conversation
    let messages = await llm.messages(thread_id) // @todo - limit to 25 messages or modify request
    if(!messages?.length)
        return false
    let disclaimer=`INFORMATIONAL ONLY **DO NOT PROCESS**\n`,
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
    const items = ( await avatar.collections(type) )
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
        conversation_id: Conversation.id,
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
    Conversation.setThread( await llm.thread(null, summaryMessages.reverse(), metadata) )
    await Bot.setThread(Conversation.thread_id) // autosaves `thread_id`, no `await`
	console.log('mMigrateChat::SUCCESS', Bot.thread_id, Conversation.inspect(true))
    if(mAllowSave)
        Conversation.save() // no `await`
    else
        console.log('mMigrateChat::BYPASS-SAVE', Conversation.thread_id)
}
async function mThread(thread_id, llm){
	const messages = []
	const metadata = {}
	const thread = await llm.thread(thread_id, messages, metadata)
	return thread
}
/* exports */
export default BotAgent