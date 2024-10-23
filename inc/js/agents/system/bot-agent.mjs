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
	#conversation
	#factory
	#llm
	constructor(botData, factory, llm){
		this.#factory = factory
		this.#llm = llm
		botData = this.globals.sanitize(botData)
		Object.assign(this, botData)
		if(!this.id)
			throw new Error('Bot database id required')
	}
	/* public functions */
	async chat(){
		console.log('Bot::chat', this.#conversation)
		// what should be returned? Responses? Conversation object?
		return this.#conversation
	}
	getBot(){
		return this
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
	 * Retrieves a bot instance by id.
	 * @param {Guid} botId - The Bot id
	 * @returns {Promise<Bot>} - The Bot instance
	 */
	bot(botId){
		const Bot = this.#bots
			.find(bot=>bot.id===botId)
		return Bot
	}
	/**
	 * Creates a bot instance.
	 * @param {Object} botData - The bot data object
	 * @returns {Bot} - The created Bot instance
	 */
	async botCreate(botData){
		const Bot = await mBotCreate(this.#avatarId, this.#vectorstoreId, botData, this.#factory)
		this.#bots.push(Bot)
		this.setActiveBot(Bot.id)
		return Bot
	}
	/**
	 * Deletes a bot instance.
	 * @async
	 * @param {Guid} botId - The Bot id
	 * @returns {Promise<void>}
	 */
	async botDelete(botId){
		const Bot = this.#bots.find(bot=>bot.id===botId)
		if(!Bot)
			throw new Error(`Bot not found with id: ${ botId }`)
		await mBotDelete(Bot, this.#bots, this.#llm, this.#factory)
	}
	async chat(){
		return this.activeBot.chat()
	}
	/**
	 * Initializes a conversation, currently only requested by System Avatar, but theoretically could be requested by any externally-facing Member Avatar as well. **note**: not in Q because it does not have a #botAgent yet.
	 * @param {String} type - The type of conversation, defaults to `chat`
	 * @param {String} form - The form of conversation, defaults to `system-avatar`
	 * @returns {Promise<Conversation>} - The conversation object
	 */
	async conversationStart(type='chat', form='system-avatar'){
		const { bot_id, } = this.avatar
		const Conversation = await mConversationStart(type, form, null, bot_id, this.#llm, this.#factory)
		return Conversation
	}
	/**
	 * Retrieves bots by instance.
	 * @returns {Bot[]} - The array of bots
	 */
	getBots(){
		return this.#bots
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
	 * Sets the active bot for the BotAgent.
	 * @param {Guid} botId - The Bot id
	 * @returns {void}
	 */
	setActiveBot(botId=this.avatar?.id){
		const Bot = this.#bots.find(bot=>bot.id===botId)
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
		console.log('BotAgent::activeBotId', this.#activeBot, this)
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
	 * Gets the array of bots employed by this BotAgent. For full instances, call `getBots()`.
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
 * @param {LLMServices} llmServices - OpenAI object
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(botData, llmServices){
    const { bot_name, type, } = botData
	botData.name = bot_name
		?? `_member_${ type }`
    const bot = await llmServices.createBot(botData)
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
 * @todo - botData.name = botDbName should not be required, push logic to `llm-services`
 * @module
 * @async
 * @param {Guid} avatarId - The Avatar id
 * @param {String} vectorstore_id - The Vectorstore id
 * @param {Object} bot - The bot data
 * @param {AgentFactory} factory - Agent Factory instance
 * @returns {Promise<Bot>} - Created Bot instance
*/
async function mBotCreate(avatarId, vectorstore_id, bot, factory){
	/* validation */
	const { type, } = bot
	if(!avatarId?.length || !type?.length)
		throw new Error('avatar id and type required to create bot')
	const { instructions, version, } = mBotInstructions(factory, bot)
	const model = process.env.OPENAI_MODEL_CORE_BOT
		?? process.env.OPENAI_MODEL_CORE_AVATAR
		?? 'gpt-4o'
	const { tools, tool_resources, } = mGetAIFunctions(type, factory.globals, vectorstore_id)
	const id = factory.newGuid
    let {
        bot_name = `My ${type}`,
        description = `I am a ${type} for ${factory.memberName}`,
        name = `bot_${type}_${avatarId}`,
    } = bot
	const botData = {
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
	const { id: bot_id, thread_id, } = await mBotCreateLLM(botData, llm)
	if(!bot_id?.length)
		throw new Error('bot creation failed')
	/* create in MyLife datastore */
	botData.bot_id = bot_id
	botData.thread_id = thread_id
	const Bot = new Bot(await factory.createBot(botData))
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
 * @param {object} Bot - The bot object to delete
 * @param {Object[]} bots - The bots array
 * @param {LLMServices} llm - OpenAI object
 * @param {AgentFactory} factory - Agent Factory object
 * @returns {void}
 */
async function mBotDelete(Bot, bots, llm, factory){
    const cannotRetire = ['actor', 'system', 'personal-avatar']
    const { bot_id, id, thread_id, type, } = bot
    if(cannotRetire.includes(type))
        throw new Error(`Cannot retire bot type: ${ type }`)
    /* delete from memory */
    const botId = bots.findIndex(_bot=>_bot.id===id)
    if(botId<0)
        throw new Error('Bot not found in bots.')
    bots.splice(botId, 1)
    /* delete bot from Cosmos */
    factory.deleteItem(id)
    /* delete thread and bot from OpenAI */
    llm.deleteBot(bot_id)
    llm.deleteThread(thread_id)
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
 * @param {BotFactory} factory - Factory object
 * @param {object} bot - Bot object
 * @returns {object} - minor 
 */
function mBotInstructions(factory, bot){
	const { type=mDefaultBotType, } = bot
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
	/* assess and validate limit */
    return { instructions, version, }
}
/**
 * Updates bot in Cosmos, and if necessary, in LLM. Returns unsanitized bot data document.
 * @param {AgentFactory} factory - Factory object
 * @param {LLMServices} llm - LLMServices object
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
	if(bot_id?.length && (instructions || name || tools)){
		botData.model = factory.globals.currentOpenAIBotModel // not dynamic
		await llm.updateBot(botData)
		const updatedLLMFields = Object.keys(botData)
			.filter(key=>key!=='id' && key!=='bot_id') // strip mechanicals
		console.log(chalk.green('mUpdateBot()::update in OpenAI'), id, bot_id, updatedLLMFields)
	}
	const updatedBotData = await factory.updateBot(botData)
	return updatedBotData
}
/**
 * Create a new conversation.
 * @async
 * @module
 * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, system, etc.; defaults to `chat`
 * @param {string} form - Form of conversation: system-avatar, member-avatar, etc.; defaults to `system-avatar`
 * @param {string} thread_id - The openai thread id
 * @param {string} botId - The bot id
 * @returns {Conversation} - The conversation object
 */
async function mConversationStart(form='system', type='chat', thread_id, llmAgentId, llm, factory){
	const { mbr_id, } = factory
	const thread = await llm.thread(thread_id)
	const Conversation = new (factory.conversation)(
		{
			form,
			mbr_id,
			type,
		},
		factory,
		thread,
		llmAgentId
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
 * @param {LLMServices} llm - The LLM instance
 * @returns {void}
 */
async function mInit(BotAgent, bots, factory, llm){
	const { avatarId, vectorstoreId, } = BotAgent
	bots.push(...await mInitBots(avatarId, vectorstoreId, factory, llm))
	BotAgent.setActiveBot()
	console.log('BotAgent::init', BotAgent.activeBot)
}
/**
 * Initializes active bots based upon criteria.
 * @param {Guid} avatarId - The Avatar id
 * @param {String} vectorstore_id - The Vectorstore id
 * @param {AgentFactory} factory - The MyLife factory instance
 * @param {LLMServices} llm - The LLM instance
 * @returns {Bot[]} - The array of activated and available bots
 */
async function mInitBots(avatarId, vectorstore_id, factory, llm){
	const bots = ( await factory.bots(avatarId) )
		.map(botData=>{
			botData.vectorstore_id = vectorstore_id
			botData.object_id = avatarId
			return new Bot(botData, factory, llm)
		})
	return bots
}
/* exports */
export default BotAgent