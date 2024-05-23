import { Marked } from 'marked'
import EventEmitter from 'events'
import oAIAssetAssistant from './agents/system/asset-assistant.mjs'
import { EvolutionAssistant } from './agents/system/evolution-assistant.mjs'
import LLMServices from './mylife-llm-services.mjs'
/* module constants */
const { MYLIFE_DB_ALLOW_SAVE, OPENAI_MAHT_GPT_OVERRIDE, } = process.env
const mAllowSave = JSON.parse(MYLIFE_DB_ALLOW_SAVE ?? 'false')
const mAvailableModes = ['standard', 'admin', 'evolution', 'experience', 'restoration']
const mBotIdOverride = OPENAI_MAHT_GPT_OVERRIDE
/**
 * @class
 * @extends EventEmitter
 * @description An avatar is a digital self proxy of Member. Not of the class but of the human themselves - they are a one-to-one representation of the human, but the synthetic version that interopts between member and internet when inside the MyLife platform. The Avatar is the manager of the member experience, and is the primary interface with the AI (aside from when a bot is handling API request, again we are speaking inside the MyLife platform).
 * @todo - deprecate `factory` getter
 * @todo - more efficient management of module constants, should be classes?
 */
class Avatar extends EventEmitter {
    #activeBotId // id of active bot in this.#bots; empty or undefined, then this
    #activeChatCategory = mGetChatCategory()
    #assetAgent
    #bots = []
    #conversations = []
    #evolver
    #experienceGenericVariables = {
        age: undefined,
        birthdate: undefined,
        birthplace: undefined,
        interests: undefined,
        memberName: undefined,
        memberFirstName: undefined,
        name: undefined, // memberName
        nickname: undefined,
    } // object of experience variables, comprise `system` "hard-coded" variables
    #factory // do not expose
    #livedExperiences = [] // array of ids for lived experiences
    #livingExperience
    #llmServices
    #mode = 'standard' // interface-mode from module `mAvailableModes`
    #nickname // avatar nickname, need proxy here as getter is complex
    #proxyBeing = 'human'
    /**
     * @constructor
     * @param {Object} obj - The data object from which to create the avatar
     * @param {Factory} factory - The member factory on which avatar relies for all service interactions
     * @param {LLMServices} llmServices - The LLM services object
     */
    constructor(factory, llmServices){
        super()
        this.#factory = factory
        this.#llmServices = llmServices
        this.#assetAgent = new oAIAssetAssistant(this.#factory, this.globals, this.#llmServices)
    }
    /* public functions */
    /**
     * Initialize the Avatar class.
     * @todo - create class-extender specific to the "singleton" MyLife avatar
     * @async
     * @public
     * @returns {Promise} Promise resolves to this Avatar class instantiation
     */
    async init(){
        const obj = await this.#factory.avatarProperties()
        Object.entries(obj)
            .forEach(([key, value]) => {
                if( // exclude certain properties
                        ['being', 'mbr_id'].includes(key)
                    ||  ['$', '_', ' ', '@', '#',].includes(key[0])
                )
                    return
                this[key] = value
            })
        this.nickname = this.nickname ?? this.names?.[0] ?? `${this.memberFirstName ?? 'member'}'s avatar`
        /* create evolver (exclude MyLife) */
        this.#bots = await this.#factory.bots(this.id)
        let activeBot = this.avatarBot
        if(!this.isMyLife){
            /* bot checks */
            const requiredBotTypes = ['library', 'personal-avatar', 'personal-biographer',]
            await Promise.all(
                requiredBotTypes
                    .map(async botType=>{
                        if(!this.#bots.some(bot=>bot.type===botType)){
                            const _bot = await mBot(this.#factory, this, { type: botType })
                            this.#bots.push(_bot)
                        }
                }
            ))
            activeBot = this.avatarBot // second time is a charm
            this.activeBotId = activeBot.id
            this.#llmServices.botId = activeBot.bot_id
            /* conversations */
            this.#bots.forEach(async bot=>{
                const { thread_id, } = bot
                if(thread_id)
                    this.#conversations.push(await this.createConversation('chat', thread_id))
            })
            /* experience variables */
            this.#experienceGenericVariables = mAssignGenericExperienceVariables(this.#experienceGenericVariables, this)
            /* lived-experiences */
            this.#livedExperiences = await this.#factory.experiencesLived(false)
            /* evolver */
            this.#evolver = new EvolutionAssistant(this)
            mAssignEvolverListeners(this.#factory, this.#evolver, this)
            /* init evolver */
            await this.#evolver.init()
        } else { // @stub - Q-specific, leave as `else` as is near always false
            this.activeBotId = activeBot.id
            activeBot.bot_id = mBotIdOverride ?? activeBot.bot_id
            this.#llmServices.botId = activeBot.bot_id
            const conversation = await this.createConversation()
            activeBot.thread_id = conversation.threadId
            this.#proxyBeing = 'MyLife'
        }
        this.emit('avatar-init-end', this.conversations)
        return this
    }
    /**
     * Get a bot.
     * @public
     * @param {string} _bot_id - The bot id.
     * @returns {object} - The bot.
     */
    async bot(_bot_id){
        return await this.#factory.bot(_bot_id)
    }
    /**
     * Processes and executes incoming chat request.
     * @todo - cleanup/streamline frontend communication as it really gets limited to Q&A... other events would fire API calls on the same same session, so don't need to be in chat or conversation streams
     * @public
     * @param {string} activeBotId - The active bot id.
     * @param {string} threadId - The openai thread id.
     * @param {string} chatMessage - The chat message content.
     * @returns {object} - The response(s) to the chat request.
    */
    async chatRequest(activeBotId, threadId, chatMessage){
        const processStartTime = Date.now()
        if(this.isMyLife){ /* MyLife chat request hasn't supplied basics to front-end yet */
            activeBotId = this.activeBot.id
            threadId = this.activeBot.thread_id
            if(this.#factory.registrationData) // trigger confirmation until session (or vld) ends
                chatMessage = `CONFIRM REGISTRATION: ` + chatMessage
        }
        if(!chatMessage)
            throw new Error('No message provided in context')
        if(!activeBotId)
            throw new Error('Parameter `activeBotId` required.')
        const { activeBot, factory } = this
        const { id: botId, thread_id: botThreadId, } = activeBot
        if(botId!==activeBotId)
            throw new Error(`Invalid bot id: ${ activeBotId }, active bot id: ${ botId }`)
        if(botThreadId!==threadId)
            throw new Error(`Invalid thread id: ${ threadId }, active thread id: ${ botThreadId }`)
        let conversation = this.getConversation(threadId)
        if(!conversation)
            throw new Error('No conversation found for thread id and could not be created.')
        conversation.botId = activeBot.bot_id // pass in via quickly mutating conversation (or independently if preferred in end), versus llmServices which are global
        const messages = await mCallLLM(this.#llmServices, conversation, chatMessage, factory)
        conversation.addMessages(messages)
        if(mAllowSave)
            conversation.save()
        else
            console.log('chatRequest::BYPASS-SAVE', conversation.message?.content)
        /* frontend mutations */
        const { activeBot: bot } = this
        // current fe will loop through messages in reverse chronological order
        const chat = conversation.messages
            .filter(message=>{ // limit to current chat response(s); usually one, perhaps faithfully in future [or could be managed in LLM]
                return messages.find(_message=>_message.id===message.id)
                    && message.type==='chat'
                    && message.role!=='user'
            })
            .map(message=>mPruneMessage(bot, message, 'chat', processStartTime))
        return chat
    }
    /**
     * Get member collection items.
     * @todo - trim return objects based on type
     * @param {string} type - The type of collection to retrieve, `false`-y = all.
     * @returns {array} - The collection items with no wrapper.
     */
    async collections(type){
        if(type==='file'){
            await this.#assetAgent.init() // bypass factory for files
            return this.#assetAgent.files
        } // bypass factory for files
        const { factory, } = this
        const collections = ( await factory.collections(type) )
            .map(collection=>{
                switch(type){
                    case 'experience':
                    case 'lived-experience':
                        const { completed=true, description, experience_date=Date.now(), experience_id, id, title, variables, } = collection
                        return {
                            completed,
                            description,
                            experience_date,
                            experience_id,
                            id,
                            title,
                            variables,
                        }
                    default:
                        return collection
                }
            })
        return collections
    }
    /**
     * Create a new bot. Errors if bot cannot be created.
     * @async
     * @public
     * @param {object} bot - The bot data object, requires type.
     * @returns {object} - The new bot.
     */
    async createBot(bot){
        const { type, } = bot
        if(!type)
            throw new Error('Bot type required to create.')
        const singletonBotExists = this.bots
            .filter(_bot=>_bot.type===type && !_bot.allowMultiple) // same type, self-declared singleton
            .filter(_bot=>_bot.allowedBeings?.includes('avatar')) // avatar allowed to create
            .length
        if(singletonBotExists)
            throw new Error(`Bot type "${type}" already exists and bot-multiples disallowed.`)
        const assistant = await mBot(this.#factory, this, bot)
        return mPruneBot(assistant)
    }
    /**
     * Create a new conversation.
     * @async
     * @public
     * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, etc.; defaults to `chat`.
     * @param {string} threadId - The openai thread id.
     * @returns {Conversation} - The conversation object.
     */
    async createConversation(type='chat', threadId){
        const thread = await this.#llmServices.thread(threadId)
        const conversation = new (this.#factory.conversation)({ mbr_id: this.mbr_id, type: type }, this.#factory, thread, this.activeBotId) // guid only
        this.#conversations.push(conversation)
        return conversation
    }
    /**
     * Delete an item from member container.
     * @async
     * @public
     * @param {Guid} id - The id of the item to delete.
     * @returns {boolean} - true if item deleted successfully.
     */
    async deleteItem(id){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot delete items.')
        return await this.factory.deleteItem(id)
    }
    /**
     * Ends an experience.
     * @todo - allow guest experiences
     * @todo - create case for member ending with enough interaction to _consider_ complete
     * @todo - determine whether modes are appropriate; while not interested in multiple session experiences, no reason couldn't chat with bot
     * @todo - relived experiences? If only saving by experience id then maybe create array?
     * @public
     * @param {Guid} experienceId - The experience id.
     * @returns {void} - Throws error if experience cannot be ended.
     */
    experienceEnd(experienceId){
        const { experience, factory, mode, } = this
        if(this.isMyLife) // @stub - allow guest experiences
            throw new Error('FAILURE::experienceEnd()::MyLife avatar cannot conduct nor end experiences at this time.')
        if(mode!=='experience')
            throw new Error('FAILURE::experienceEnd()::Avatar is not currently in an experience.')
        if(this.experience?.id!==experienceId)
            throw new Error('FAILURE::experienceEnd()::Avatar is not currently in the requested experience.')
        this.mode = 'standard'
        const { id, location, title, variables, } = experience
        const { mbr_id, newGuid, } = factory
        const completed = location?.completed
        this.#livedExperiences.push({ // experience considered concluded for session regardless of origin, sniffed below
            completed,
			experience_date: Date.now(),
			experience_id: id,
			id: newGuid,
			mbr_id,
			title,
			variables,
        })
        if(completed){ // ended "naturally," by event completion, internal initiation
            /* validate and cure `experience` */
            /* save experience to cosmos (no await) */
            factory.saveExperience(experience)
        } else { // incomplete, force-ended by member, external initiation
            // @stub - create case for member ending with enough interaction to _consider_ complete, or for that matter, to consider _started_ in some cases
        }
        this.experience = undefined
    }
    /**
     * Processes and executes incoming experience request.
     * @todo - experienceStart has error when route ends in '/', allowed, but fails beacuse eid = guid +'/'
     * @public
     * @param {Guid} experienceId - The experience id.
     * @param {object} memberInput - The member input.
     * @returns {Promise<array>} - The next sequence of evets in experience for front-end.
     */
    async experiencePlay(experienceId, memberInput){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot present experiences to itself.')
        if(this.mode!=='experience')
            throw new Error('Avatar is not currently in an experience. Experiences must be started.')
        if(experienceId!==this.experienceLocation.experienceId)
            throw new Error(`Experience failure, unexpected experience id mismatch\n- experienceId: ${experienceId} \n- location: ${this.experienceLocation.experienceId}`)
        const events = await mExperiencePlay(
            this.#factory,
            this.#llmServices,
            this.experience,
            memberInput,
        )
        return events // final manifest of events [question, could manifest still be needed?]
    }
    /**
     * Returns array of available experiences for the member in shorthand object format, i.e., not a full `Experience` class instance. That is only required when performing.
     * @public
     * @param {boolean} includeLived - Include lived experiences in the list.
     * @returns {Promise<Object[]>} - Array of Experiences "shorthand" objects.
     * @property {Guid} autoplay - The id of the experience to autoplay, if any.
     * @property {Object[]} experiences - Array of shorthand experiences.
     */
    async experiences(includeLived=false){
        const experiences = mExperiences(await this.#factory.experiences(includeLived))
        return experiences
    }
    /**
     * Starts an avatar experience.
     * @todo - scene and event id start points
     * @param {Guid} experienceId - Experience id to start.
     * @param {Guid} sceneId - Scene id to start, optional.
     * @param {Guid} eventId - Event id to start, optional.
     * @returns {Promise<void>} - Returns void if avatar started experience successfully.
     */
    async experienceStart(experienceId, sceneId, eventId){
        if(this.mode==='experience')
            throw new Error(`Avatar is currently conducting experience "${this.experience.id}"`)
        await mExperienceStart( // throws error if fails
            this,
            this.#factory,
            experienceId,
            this.#experienceGenericVariables
        )
    }
    /**
     * Gets Conversation object. If no thread id, creates new conversation.
     * @param {string} threadId - openai thread id
     * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, etc.
     * @returns {Conversation} - The conversation object.
     */
    getConversation(threadId){
        const conversation = this.#conversations
            .find(conversation=>conversation.thread?.id ?? conversation.thread_id===threadId)
        return conversation
    }
    /**
     * Returns all conversations of a specific-type stored in memory.
     * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, etc.; defaults to `chat`.
     * @returns {Conversation[]} - The array of conversation objects.
     */
    getConversations(type='chat'){
        return this.#conversations
            .filter(_=>_?.type===type)
    }
    /**
     * Get a static or dynamic greeting from active bot.
     * @param {boolean} dynamic - Whether to use LLM for greeting.
     * @returns {array} - The greeting message(s) string array in order of display.
     */
    async getGreeting(dynamic=false){
        return await mGreeting(this.activeBot, dynamic, this.#llmServices, this.#factory)
    }
    /**
     * Request help about MyLife. **caveat** - correct avatar should have been selected prior to calling.
     * @param {string} helpRequest - The help request text.
     * @param {string} type - The type of help request.
     * @returns {Promise<Object>} - openai `message` objects.
     */
    async help(helpRequest, type){
        const processStartTime = Date.now()
        if(!helpRequest?.length)
            throw new Error('Help request required.')
        // @stub - force-type into enum?
        helpRequest = mHelpIncludePreamble(type, this.isMyLife) + helpRequest
        const { thread_id, } = this.activeBot
        const { bot_id, } = this.helpBots?.find(bot=>(bot?.subType ?? bot?.sub_type ?? bot?.subtype)===type)
            ?? this.helpBots?.[0]
            ?? this.activeBot
        // @stub rewrite mCallLLM, but ability to override conversation? No, I think in general I would prefer this to occur at factory  as it is here
        const conversation = this.getConversation(thread_id)
        const helpResponseArray = await this.factory.help(thread_id, bot_id, helpRequest)
        conversation.addMessages(helpResponseArray)
        if(mAllowSave)
            conversation.save()
        else
            console.log('chatRequest::BYPASS-SAVE', conversation.message.content)
        const response = mPruneMessages(this.activeBot, helpResponseArray, 'help', processStartTime)
        return response
    }
    /**
     * Returns all conversations of a specific-type stored in memory.
     * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, etc.; defaults to `chat`.
     * @returns {Conversation[]} - The array of conversation objects.
     */
    getConversations(type='chat'){
        return this.#conversations
            .filter(_=>_?.type===type)
    }
    /**
     * Request help about MyLife. **caveat** - correct avatar should have been selected prior to calling.
     * @param {string} helpRequest - The help request text.
     * @param {string} type - The type of help request.
     * @returns {Promise<Object>} - openai `message` objects.
     */
    async help(helpRequest, type){
        const processStartTime = Date.now()
        if(!helpRequest?.length)
            throw new Error('Help request required.')
        // @stub - force-type into enum?
        helpRequest = mHelpIncludePreamble(type, this.isMyLife) + helpRequest
        const { thread_id, } = this.activeBot
        const { bot_id, } = this.helpBots?.find(bot=>(bot?.subType ?? bot?.sub_type ?? bot?.subtype)===type)
            ?? this.helpBots?.[0]
            ?? this.activeBot
        // @stub rewrite mCallLLM, but ability to override conversation? No, I think in general I would prefer this to occur at factory  as it is here
        const conversation = this.getConversation(thread_id)
        const helpResponseArray = await this.factory.help(thread_id, bot_id, helpRequest)
        conversation.addMessages(helpResponseArray)
        if(mAllowSave)
            conversation.save()
        else
            console.log('helpRequest::BYPASS-SAVE', conversation.message.content)
        const response = mPruneMessages(this.activeBot, helpResponseArray, 'help', processStartTime)
        return response
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
        return await this.#factory.resetPassphrase(passphrase)
    }
    /**
     * Processes and executes incoming category set request.
     * @todo - deprecate if possible.
     * @public
     * @param {string} _category - The category to set { category, contributionId, question }.
     */
    setActiveCategory(_category){
        const _proposedCategory = mGetChatCategory(_category)
        /* evolve contribution */
        if(_proposedCategory?.category){ // no category, no contribution
            this.#evolver.setContribution(this.#activeChatCategory, _proposedCategory)
        }
    }
    /**
     * Add or update bot, and identifies as activated, unless otherwise specified.
     * @todo - strip protected bot data/create class?.
     * @param {object} bot - Bot-data to set.
     * @param {boolean} activate - Whether to activate bot, default=`true`.
     * @returns {object} - The updated bot.
     */
    async setBot(bot, activate=true){
        bot = await mBot(this.#factory, this, bot)
        /* add/update bot */
        if(!this.#bots.some(_bot => _bot.id === bot.id))
            this.#bots.push(bot)
        else
            this.#bots = this.#bots.map(_bot=>_bot.id===bot.id ? bot : _bot)
        /* activation */
        if(activate)
            this.activeBotId = bot.id
        return bot
    }
    async thread_id(){
        if(!this.#conversations.length){
            await this.createConversation()
        }
        return this.#conversations[0].threadId
    }
    /**
     * Upload files to MyLife and/or LLM.
     * @todo - implement MyLife file upload.
     * @param {File[]} files - The array of files to upload.
     * @param {boolean} includeMyLife - Whether to include MyLife in the upload, defaults to `false`.
     * @returns {boolean} - true if upload successful.
     */
    async upload(files, includeMyLife=false){
        if(this.isMyLife)
            throw new Error('MyLife avatar cannot upload files.')
        const { vectorstoreId, } = this.#factory
        await this.#assetAgent.init(this.#factory.vectorstoreId, includeMyLife) /* or "re-init" */
        await this.#assetAgent.upload(files)
        const { response, vectorstoreId: newVectorstoreId, vectorstoreFileList, } = this.#assetAgent
        if(!vectorstoreId && newVectorstoreId)
            this.updateTools()
        return {
            uploads: files,
            files: vectorstoreFileList,
            success: true,
        }
    }
    /**
     * Update tools for bot-assistant based on type.
     * @todo - manage issue that several bots require attachment upon creation.
     * @todo - move to llm code.
     * @todo - allow for multiple types simultaneously.
     * @param {string} bot_id - The bot id to update tools for.
     * @param {string} type - The type of tool to update.
     * @param {any} data - The data required by the switch type.
     * @returns {void}
     */
    async updateTools(botId=this.avatarBot.bot_id, type='file_search', data){
        let tools
        switch(type){
            case 'function': // @stub - function tools
                tools = {
                    tools: [{ type: 'function' }],
                    function: {},
                }
                break
            case 'file_search':
            default:
                if(!this.#factory.vectorstoreId)
                    return
                tools = {
                    tools: [{ type: 'file_search' }],
                    tool_resources: {
                        file_search: {
                            vector_store_ids: [this.#factory.vectorstoreId],
                        }
                    },
                }
        }
        if(tools)
            this.#llmServices.updateAssistant(botId, tools) /* no await */
    }
    /**
     * Validate registration id.
     * @todo - move to MyLife only avatar variant.
     * @param {Guid} validationId - The registration id.
     * @returns {Promise<Object[]>} - Array of system messages.
     */
    async validateRegistration(validationId){
        const { messages, registrationData, success, } = await mValidateRegistration(this.activeBot, this.#factory, validationId)
        if(success){
            // @stub - move to MyLife only avatar variant, where below are private vars
            this.#factory.registrationData = registrationData
        }
        return messages
    }
    /* getters/setters */
    /**
     * Get the active bot. If no active bot, return this as default chat engine.
     * @getter
     * @returns {object} - The active bot.
     */
    get activeBot(){
        return this.#bots.find(_bot=>_bot.id===this.activeBotId)
    }
    get activeBotAIId(){
        return this.activeBot.bot_id
    }
    /**
     * Get the active bot id.
     * @getter
     * @returns {string} - The active bot id.
     */
    get activeBotId(){
        return this.#activeBotId
    }
    /**
     * Set the active bot id. If not match found in bot list, then defaults back to this.id
     * @setter
     * @param {string} _bot_id - The active bot id.
     * @returns {void}
     */
    set activeBotId(_bot_id){ // default PA
        if(!_bot_id?.length)
            _bot_id = this.avatarBot.id
        this.#activeBotId = mFindBot(this, _bot_id)?.id??this.avatarBot.id
    }
    /**
     * Get actor or default avatar bot.
     * @getter
     * @returns {object} - The actor bot (or default bot).
     */
    get actorBot(){
        return this.#bots.find(_bot=>_bot.type==='actor')??this.avatarBot
    }
    /**
     * Get the age of the member.
     * @getter
     * @returns {number} - The member's age.
     */
    get age(){
        if(!this.birthdate)
            return 0
        const birthdate = new Date(this.birthdate)
        const today = new Date()
        let age = today.getFullYear() - birthdate.getFullYear();
        const isBirthdayPassedThisYear = today.getMonth() > birthdate.getMonth()
        || (
                today.getMonth() === birthdate.getMonth() 
            &&  today.getDate() >= birthdate.getDate()
            )
        if (!isBirthdayPassedThisYear) {
            age -= 1 // Subtract a year if the birthday hasn't occurred yet this year
        }
        return age
    }
    /**
     * Returns provider for avatar intelligence.
     * @getter
     * @returns {object} - The avatar intelligence provider, currently only openAI API GPT.
     */
    get ai(){
        return this.#llmServices
    }
    /**
     * Get the personal avatar bot.
     * @getter
     * @returns {object} - The personal avatar bot.
     */
    get avatarBot(){
        return this.bots.find(_bot=>_bot.type==='personal-avatar')
    }
    /**
     * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
     * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
     * @getter
     * @returns {string} The object being the avatar is emulating.
    */
    get being(){    //  
        return this.#proxyBeing
    }
    /**
     * Get the birthdate of _member_ from `#factory`.
     * @getter
     * @returns {string} - The member's birthdate.
     */
    get birthdate(){
        return this.core?.birthdate
            ?? this.core?.birth?.date
            ?? this.core?.birth?.[0]?.date
    }
    /**
     * Get the birthplace of _member_ from `#factory`.
     * @getter
     * @returns {string} - The member's birthplace.
     */
    get birthplace(){
        return this.core.birthplace
            ?? this.core.birth?.place
            ?? this.core.birth?.[0]?.place
    }
    /**
     * Gets all Avatar bots.
     * @getter
     * @returns {array} - The bots.
     */
    get bots(){
        return this.#bots
    }
    /**
     * Get the cast members in frontend format.
     * @getter
     * @returns {Object[]} - Array of ExperienceCastMembers.
     */
    get cast(){
        return this.experience.castMembers
    }
    /**
     * Get the active chat category.
     * @getter
     * @returns {string} - The active chat category.
     */
    get category(){
        return this.#activeChatCategory
    }
    /**
     * Set the active chat category.
     * @setter
     * @param {string} _category - The new active chat category.
     * @returns {void}
     */
    set category(_category){
        this.#activeChatCategory = _category
    }
    /**
     * Get the cast.
     * @getter
     * @returns {array} - The cast.
     */
    get cast(){
        return this.experience.cast
    }
    /**
     * Get contributions.
     * @getter
     * @returns {array} - The contributions.
     */
    get contributions(){
        return this.#evolver?.contributions
    }
    /**
     * Set incoming contribution.
     * @setter
     * @param {object} _contribution
    */
    set contribution(_contribution){
        this.#evolver.contribution = _contribution
    }
    /**
     * Get uninstantiated class definition for conversation. If getting a specific conversation, use .conversation(id).
     * @getter
     * @returns {class} - class definition for conversation
     */
    get conversation(){
        return this.#factory.conversation
    }
    /**
     * Get conversations. If getting a specific conversation, use .conversation(id).
     * @getter
     * @returns {array} - The conversations.
     */
    get conversations(){
        return this.#conversations
    }
    /**
     * Get the datacore.
     * @getter
     * @returns {object} - The Member's datacore.
     */
    get core(){
        return this.#factory.core
    }
    /**
     * Get the current experience.
     * @getter
     * @returns {object} - The current experience.
     */
    get experience(){
        return this.#livingExperience
    }
    /**
     * Set the experience.
     * @setter
     * @todo - test experience for type and validity.
     * @param {any} experience - The new experience.
     */
    set experience(experience){
        this.#livingExperience = experience
    }
    /**
     * Get the current experience location (or pointer). Should always map to the last event being sent, if inspecting an array of events via `api.experience()`.
     * @getter
     * @returns {object} - The current experience location.
     */
    get experienceLocation(){
        return this.experience.location
    }
    /**
     * Returns List of Member's Lived Experiences.
     * @getter
     * @returns {Object[]} - List of Member's Lived Experiences.
     */
    get experiencesLived(){
        return this.#livedExperiences
    }
    /**
     * Get the Avatar's Factory.
     * @todo - deprecate if possible, return to private
     * @getter
     * @returns {AgentFactory} - The Avatar's Factory.
     */
    get factory(){
        return this.#factory
    }
    /**
     * Globals shortcut.
     * @getter
     * @returns {object} - The globals.
     */
    get globals(){
        return this.#factory.globals
    }
    /**
     * Get the help bots, primarily MyLife avatar, though presume there are a number of custom self-help bots that would be capable of referencing preferences, internal searches, etc.
     * @getter
     * @returns {array} - The help bots.
     */
    get helpBots(){
        return this.bots.filter(bot=>bot.type==='help')
    }
    /**
     * Test whether avatar is in an `experience`.
     * @getter
     * @returns {boolean} - Avatar is in `experience` (true) or not (false).
     */
    get isInExperience(){
        return this.mode==='experience'
    }
    /**
     * Whether or not the avatar is the MyLife avatar.
     * @getter
     * @returns {boolean} - true if the avatar is the MyLife avatar. 
     */
    get isMyLife(){
        return this.#factory.isMyLife
    }
    /**
     * Get the current living experience.
     * @getter
     * @returns {object} - The current living experience.
     */
    get livingExperience(){
        return this.experience
    }
    /**
     * Returns manifest for navigation of scenes/events and cast for the current experience.
     * @returns {ExperienceManifest} - The experience manifest.
     * @property {ExperienceCastMember[]} cast - The cast array for the experience.
     * @property {Object[]} navigation - The scene navigation array for the experience.
     */
    get manifest(){
        if(!this.isInExperience)
            throw new Error('Avatar is not currently in an experience.')
        return this.experience.manifest
    }
    /**
     * Get the member id.
     * @getter
     * @returns {string} - The member's id.
     */
    get mbr_id(){
        return this.#factory.mbr_id
    }
    /**
     * Get the guid portion of member id.
     * @todo - deprecate to `mbr_sysId`
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get mbr_id_id(){
        return this.mbr_sysId
    }
    /**
     * Get the system name portion of member id.
     * @todo - deprecate to `mbr_sysName`
     * @getter
     * @returns {guid} - The member's system name.
     */
    get mbr_name(){
        return this.mbr_sysName
    }
    /**
     * Get the guid portion of member id.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get mbr_sysId(){
        return this.globals.sysId(this.mbr_id)
    }
    /**
     * Get the system name portion of member id.
     * @getter
     * @returns {guid} - The member's system name.
     */
    get mbr_sysName(){
        return this.globals.sysName(this.mbr_id)
    }
    /**
     * Gets first name of member from `#factory`.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get memberFirstName(){
        return this.memberName.split(' ')[0]??this.nickname??this.name
    }
    /**
     * Gets full name of member from `#factory`.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get memberName(){
        return this.#factory.memberName
    }
    /**
     * Get uninstantiated class definition for message.
     * @getter
     * @returns {class} - class definition for message
     */
    get message(){
        return this.#factory.message
    }
    /**
     * Get the mode.
     * @getter
     * @returns {string} - The current active mode.
     */
    get mode(){
        return this.#mode
    }
    /**
     * Set the mode. If mode request is invalid, does not change mode and throws error in order to identify failure.
     * @setter
     * @param {string} requestedMode - The new mode.
     * @returns {void}
     */
    set mode(requestedMode){
        this.#mode = mValidateMode(requestedMode, this.mode)
    }
    /**
     * Get the name of the avatar. Note: this.name is normally the Cosmos nomenclature, so we do not write to it, and use it's value as a last resort.
     * @getter
     * @returns {string} - The avatar name.
     */
    get name(){
        return this.nickname
    }
    /**
     * Proxy to set the nickname of the avatar.
     * @setter
     * @param {string} name - The new avatar nickname.
     * @returns {void}
     */
    set name(name){
        /* set nothing */
    }
    /**
     * Get experience scene navigation array.
     * @getter
     * @returns {Object[]} - The scene navigation array for the experience.
     * @property {Guid} id - The scene id.
     * @property {string} description - The scene description.
     * @property {Object[]} events - The scene events. @stub
     * @property {number} order - The scene order, default=1.
     * @property {boolean} required - Whether the scene is required, default=false.
     * @property {boolean} skippable - Whether the scene is skippable, default=true.
     * @property {string} title - The scene name.
     */
    get navigation(){
        return this.experience.navigation
    }
    /**
     * Get the nickname of the avatar.
     * @getter
     * @returns {string} - The avatar nickname.
     */
    get nickname(){
        return this.#nickname
    }
    /**
     * Set the nickname of the avatar; only set if different from name.
     * @setter
     * @param {string} nickname - The new avatar nickname.
     * @returns {void}
     */
    set nickname(nickname){
        if(nickname!==this.name)
            this.#nickname = nickname
    }
}
/* module functions */
/**
 * Assigns evolver listeners.
 * @module
 * @param {AgentFactory} factory - Agent Factory object
 * @param {EvolutionAssistant} evolver - Evolver object
 * @param {Avatar} avatar - Avatar object
 * @returns {void}
 */
function mAssignEvolverListeners(factory, evolver, avatar){
    /* assign evolver listeners */
    evolver.on(
        'on-contribution-new',
        _contribution=>{
            _contribution.emit('on-contribution-new', _contribution)
        }
    )
    evolver.on(
        'avatar-change-category',
        (_current, _proposed)=>{
            avatar.category = _proposed
            console.log('avatar-change-category', avatar.category.category)
        }
    )
    evolver.on(
        'on-contribution-submitted',
        _contribution=>{
            // send to gpt for summary
            const _responses = _contribution.responses.join('\n')
            const _summary = factory.openai.completions.create({
                model: 'gpt-4o',
                prompt: 'summarize answers in 512 chars or less, if unsummarizable, return "NONE": ' + _responses,
                temperature: 1,
                max_tokens: 700,
                frequency_penalty: 0.87,
                presence_penalty: 0.54,
            })
            // evaluate summary
            console.log('on-contribution-submitted', _summary)
            return
            //  if summary is good, submit to cosmos
        }
    )
}
/**
 * Assigns (directly mutates) private experience variables from avatar.
 * @todo - theoretically, the variables need not come from the same avatar instance... not sure of viability
 * @module
 * @param {object} experienceVariables - Experience variables object from Avatar class definition.
 * @param {Avatar} avatar - Avatar instance.
 * @returns {void} - mutates experienceVariables
 */
function mAssignGenericExperienceVariables(experienceVariables, avatar){
    Object.keys(experienceVariables).forEach(_key=>{
        experienceVariables[_key] = avatar[_key]
    })
    /* handle unique variable instances (jic) */
    const localOverrides = {
        name: avatar.memberName,
        nickname: avatar.memberFirstName
    }
    return {...experienceVariables, ...localOverrides}
}
/**
 * Updates or creates bot (defaults to new personal-avatar) in Cosmos and returns successful `bot` object, complete with conversation (including thread/thread_id in avatar) and gpt-assistant intelligence.
 * @todo Fix occasions where there will be no object_id property to use, as it was created through a hydration method based on API usage, so will be attached to mbr_id, but NOT avatar.id
 * @module
 * @param {AgentFactory} factory - Agent Factory object
 * @param {Avatar} avatar - Avatar object that will govern bot
 * @param {object} bot - Bot object
 * @returns {object} - Bot object
 */
async function mBot(factory, avatar, bot){
    /* validation */
    const { bots, id: avatarId, isMyLife, mbr_id, } = avatar
    if(isMyLife)
        throw new Error('MyLife system avatar may not create or alter its associated bots.')
    const { newGuid, } = factory
    const { id: botId=newGuid, object_id: objectId, type: botType, } = bot
    if(!botType?.length)
        throw new Error('Bot type required to create.')
    /* set/reset required bot super-properties */
    bot.mbr_id = mbr_id /* constant */
    bot.object_id = objectId ?? avatarId /* all your bots belong to me */
    bot.id =  botId // **note**: _this_ is a Cosmos id, not an openAI id
    /* assign or create */
    let assistant = bots.find(oBot=>oBot.id===botId)
    if(assistant){ /* update bot */
        assistant = {...assistant, ...bot}
        /* create or update bot special properties */
        const { thread_id, type, } = assistant
        if(!thread_id?.length){
            const excludeTypes = ['library',]
            if(!excludeTypes.includes(type)){
                const conversation = await avatar.createConversation()
                assistant.thread_id = conversation.thread_id
            }
        }
        factory.setBot(assistant) // update Cosmos (no need async)
    } else { /* create assistant */
        assistant = await factory.createBot(bot)
        avatar.bots.push(bot)
    }
    return assistant
}
/**
 * Makes call to LLM and to return response(s) to prompt.
 * @todo - create actor-bot for internal chat? Concern is that API-assistants are only a storage vehicle, ergo not an embedded fine tune as I thought (i.e., there still may be room for new fine-tuning exercise); i.e., micro-instructionsets need to be developed for most. Unclear if direct thread/message instructions override or ADD, could check documentation or gpt, but...
 * @todo - address disconnect between conversations held in memory in avatar and those in openAI threads; use `addLLMMessages` to post internally
 * @module
 * @param {LLMServices} llmServices - OpenAI object currently
 * @param {Conversation} conversation - Conversation object
 * @param {string} prompt - dialog-prompt/message for llm
 * @param {AgentFactory} factory - Agent Factory object required for function execution
 * @returns {Promise<Object[]>} - Array of Message instances in descending chronological order.
 */
async function mCallLLM(llmServices, conversation, prompt, factory){
    const { thread_id: threadId } = conversation
    if(!threadId)
        throw new Error('No `thread_id` found for conversation')
    if(!conversation.botId)
        throw new Error('No `botId` found for conversation')
    const messages = await llmServices.getLLMResponse(threadId, conversation.botId, prompt, factory)
    messages.sort((mA, mB) => {
        return mB.created_at - mA.created_at
    })
    return messages
}
/**
 * Cancels openAI run.
 * @module
 * @param {LLMServices} llmServices - OpenAI object
 * @param {string} threadId - Thread id
 * @param {string} runId - Run id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mCancelRun(llmServices, threadId, runId,){
    return await llmServices.beta.threads.runs.cancel(
        threadId,
        runId
    )
}
/**
 * Creates cast and returns associated `cast` object.
 * @todo - move as much functionality for actor into `init()` as makes sense
 * @todo - any trouble retrieving a known actor should be understudied by... Q? or personal-avatar? yes, personal avatar for now
 * @todo - implement `creator` version of actor
 * @todo - include variables for names of roles/actors
 * @module
 * @param {AgentFactory} factory - Agent Factory object
 * @param {array} cast - Array of cast objects
 * @returns {Promise<array>} - Array of ExperienceCastMember instances
 */
async function mCast(factory, cast){
    // create `actors`, may need to create class
    cast = await Promise.all(cast.map(async castMember=>{
        const actor = new (factory.castMember)(castMember)
        switch(castMember.type.toLowerCase()){
            case 'mylife':
            case 'q':
            case 'system':
                actor.bot = await factory.systemActor
                actor.bot_id = actor.bot.id
                break
            case 'bot':
            case 'member':
            case 'member-bot':
            default:
                actor.bot = await factory.bot() // should be new-member safe, but check
                actor.bot_id = actor.bot.id
                break
        }
        return actor
    }))
    return cast
}
function mCreateSystemMessage(activeBot, message, factory){
    if(!(message instanceof factory.message)){
        const { thread_id, } = activeBot
        const content = message?.content ?? message?.message ?? message
        message = new (factory.message)({
            being: 'message',
            content,
            role: 'assistant',
            thread_id,
            type: 'system'
        })
    }
    message = mPruneMessage(activeBot, message, 'system')
    return message
}
/**
 * Takes character data and makes necessary adjustments to roles, urls, etc.
 * @todo - icon and background changes
 * @todo - bot changes... allowed?
 * @param {LLMServices} llm - OpenAI object.
 * @param {Experience} experience - Experience class instance.
 * @param {Object} character - Synthetic character object
 */
async function mEventCharacter(llm, experience, character){
    const { characterId, name, role, variables, } = character
    const castMember = experience.cast.find(castMember=>castMember.id===characterId)
    if(!castMember)
        throw new Error('Character not found in cast.')
    if(name)
        castMember.name = name.includes('@@') 
            ? mReplaceVariables(name, variables, experience.variables)
            : name
    if(role){
        castMember.role = role.includes('@@')
            ? mReplaceVariables(role, variables, experience.variables)
            : role
        character.role = castMember.role
        console.log('mEventCharacter::returnCharacter', character, castMember.role)
    }
    return character
}
/**
 * Returns processed dialog as string.
 * @todo - add LLM usage data to conversation
 * @todo - when `variable` undefined in `experience.variables`, check to see if event can be found that will provide it
 * @todo - seems unnecessary to have experience extension handling basic data construction at this stage... refactor, tho?
 * @module
 * @public
 * @param {LLMServices} llm - OpenAI object currently
 * @param {Experience} experience - Experience class instance.
 * @param {ExperienceEvent} event - Event object
 * @param {number} iteration - The current iteration number (iterations _also_ allow for `refresh` of dialog front-end)
 * @returns {Promise<string>} - Parsed piece of event dialog
 */
async function mEventDialog(llm, experience, event, iteration=0){
    const { character, dialog: eventDialog, id: eventId, useDialogCache, } = event
    if(!eventDialog || !Object.keys(eventDialog).length)
        return // no dialog to parse
    if(useDialogCache){
        const livedEvent = experience.events.find(event=>event.id===eventId)
        if(livedEvent)
            return livedEvent.dialog.dialog
    }
    if(!character)
        throw new Error('Dialog error, no character identified.')
    const { characterId: _id, id } = character
    const characterId = id ?? _id
    let dialog = experience.dialogData(eventId, iteration)
    if(!dialog)
        throw new Error('Dialog error, could not establish dialog.')
    const { content, dialog: dialogText, example, prompt: dialogPrompt, text, type, variables } = dialog
    const dialogVariables = variables ?? event.variables ?? []
    switch(type){
        case 'script':
            let scriptedDialog = dialogText
                ?? text
                ?? dialogPrompt
                ?? content
            if(!scriptedDialog)
                throw new Error('Script line requested, no content identified.')
            if(dialogVariables.length && scriptedDialog.includes('@@'))
                scriptedDialog = mReplaceVariables(scriptedDialog, dialogVariables, experience.variables)
            return scriptedDialog
        case 'prompt':
            if(!dialogPrompt)
                throw new Error('Dynamic script requested, no prompt identified.')
            let prompt = dialogPrompt
            const { cast, memberDialog, scriptAdvisorBotId, scriptDialog, variables: experienceVariables, } = experience
            const castMember = cast.find(castMember=>castMember.id===characterId)
            scriptDialog.botId = castMember.bot?.bot_id ?? scriptAdvisorBotId ?? this.activebot.bot_id // set llm assistant id
            if(example?.length)
                prompt = `using example: "${example}";\n` + prompt
            if(dialogVariables.length)
                prompt = mReplaceVariables(prompt, dialogVariables, experienceVariables)
            const messages = await mCallLLM(llm, scriptDialog, prompt) ?? []
            if(!messages.length)
                console.log('mEventDialog::no messages returned from LLM', prompt, scriptDialog.botId)
            scriptDialog.addMessages(messages)
            memberDialog.addMessage(scriptDialog.mostRecentDialog)
            return memberDialog.mostRecentDialog
        default:
            throw new Error(`Dialog type \`${type}\` not recognized`)
    }   
}
/**
 * Returns a processed memberInput event.
 * @todo - once conversations are not spurred until needed, add a third conversation to the experience, which would be the scriptAdvisor (not actor) to determine success conditions for scene, etc.
 * @todo - handle complex success conditions
 * @module
 * @public
 * @param {LLMServices} llm - OpenAI object currently.
 * @param {Experience} experience - Experience class instance.
 * @param {ExperienceEvent} event - Event object.
 * @param {number} iteration - The current iteration number.
 * @param {object} memberInput - Member input, any data type.
 * @returns {Promise<object>} - Synthetic Input Event.
 * @note - review https://platform.openai.com/docs/assistants/tools/defining-functions
 */
async function mEventInput(llm, experience, event, iteration=0, memberInput){
    const { character, id: eventId, input, type='script' } = event
    const { characterId: _id, id } = character
    const characterId = id ?? _id
    const { dialog, events, scriptAdvisor, scriptDialog, } = experience
    const hasMemberInput = memberInput && (
            ( typeof memberInput==='object' && Object.keys(memberInput)?.length )
         || ( typeof memberInput==='string' && ( memberInput.trim().length ?? false ) )
         || ( Array.isArray(memberInput) && memberInput.length && memberInput[0])
        )
    const livingEvent = events.find(_event=>_event.id===eventId)
    /* return initial or repeat request without input */
    input.complete = false
    if(!hasMemberInput){
        if(livingEvent){
            livingEvent.input.useDialogCache = true
            return livingEvent.input
        }
        return input
    }
    /* process and flatten memberInput */
    switch(input.inputType){
        case 'input':
        case 'text':
        case 'textarea':
            switch(typeof memberInput){
                case 'array':
                    memberInput = memberInput?.[0]??''
                    break
                case 'object':
                    // grab first key, ought have been string
                    memberInput = Object.values(memberInput)?.[0]??''
                    break
                }
            break
        default:
            break
    }
    /* local success variants */
    if(!input.condition?.trim()?.length){
        if(memberInput.trim().length){
            input.complete = true
            return input
        }
    }
    /* consult LLM scriptAdvisor */
    let prompt = 'CONDITION: '
        + input.condition.trim()
        + '\n'
        + 'RESPONSE: '
        + memberInput.trim()
        + '\n'
    if(input.outcome?.trim()?.length)
        prompt += 'OUTCOME: return JSON-parsable object = '
            + input.outcome.trim()
    const scriptAdvisorBotId = experience.scriptAdvisorBotId
        ?? experience.cast.find(castMember=>castMember.id===characterId)?.bot?.bot_id
        ?? experience.cast[0]?.bot?.bot_id
    const scriptConsultant = scriptAdvisor ?? scriptDialog ?? dialog
    scriptConsultant.botId = scriptAdvisorBotId
    const messages = await mCallLLM(llm, scriptConsultant, prompt) ?? []
    if(!messages.length){
        console.log('mEventInput::no messages returned from LLM', prompt, scriptAdvisorBotId, scriptConsultant)
        throw new Error('No messages returned from LLM')
    }
    scriptConsultant.addMessages(messages)
    /* validate return from LLM */
    let evaluationResponse = scriptConsultant.mostRecentDialog
    if(!evaluationResponse.length)
        throw new Error('LLM content did not return a string')
    evaluationResponse = evaluationResponse.replace(/\\n|\n/g, '')
    evaluationResponse = evaluationResponse.substring(
        evaluationResponse.indexOf('{'),
        evaluationResponse.lastIndexOf('}')+1,
    )
    try{
        evaluationResponse = JSON.parse(evaluationResponse) // convert to JSON
    } catch(err){
        console.log('JSON PARSING ERROR', err, evaluationResponse)
        evaluationResponse = evaluationResponse.replace(/([a-zA-Z0-9_$\-]+):/g, '"$1":') // keys must be in quotes
        evaluationResponse = JSON.parse(evaluationResponse)
    }
    const evaluationSuccess = evaluationResponse.success
        || (typeof evaluationResponse === 'object' && Object.keys(evaluationResponse).length)
    if(!evaluationSuccess){ // default to true, as object may well have been returned
        // @todo - handle failure; run through script again, probably at one layer up from here
        input.followup = evaluationResponse.followup ?? input.followup
        return input
    }
    input.variables.forEach(variable=>{ // when variables, add/overwrite `experience.variables`
        experience.variables[variable] = evaluationResponse.outcome?.[variable]
            ?? evaluationResponse?.[variable] // when wrong bot used, will send back raw JSON object
            ?? experience.variables?.[variable]
            ?? evaluationResponse
    })
    if(typeof input.success === 'object'){ // @stub - handle complex object success object conditions
        // denotes multiple potential success outcomes, currently scene/event branching based on content
        // See success_complex in API script, key is variable, value is potential values _or_ event guid
        // loop through keys and compare to experience.experienceVariables
    }
    input.complete = input.success ?? false
    return input
}
/**
 * Processes an event and adds appropriate accessors to `ExperienceEvent` passed instance.
 *   1. Stage `event.stage`
 *   2. Dialog `event.dialog`
 *   3. Input `event.input`
 * @todo - keep track of iterations inside `experience` to manage flow
 * @todo - JSON data should NOT be in data, but instead one of the three wrappers: stage, dialog, input; STAGE done
 * @todo - mutations should be handled by `ExperienceEvent` extenders.
 * @todo - script dialog change, input assessment, success evals to completions or cheaper? babbage-002 ($0.40/m) is only cheaper than 3.5 ($3.00/m); can test efficacy for dialog completion, otherwise, 3.5 exceptional
 * @todo - iterations need to be re-included, although for now, one dialog for experience is fine
 * @module
 * @public
 * @param {LLMServices} llm - OpenAI object currently
 * @param {Experience} experience - Experience class instance.
 * @param {ExperienceEvent} event - Event object
 * @param {object} memberInput - Member input
 * @returns {Promise<ExperienceEvent>} - Event object
 */
async function mEventProcess(llm, experience, event, memberInput){
    const { location, variables } = experience
    const { action, id } = event
    let { character, dialog, input, stage, } = event
    switch(action){ // **note**: intentional pass-throughs on `switch`
        case 'input':
            if(input && Object.keys(input).length){
                const _input = await mEventInput(llm, experience, event, undefined, memberInput)
                if(memberInput)
                    memberInput = undefined // clear for next event
                input = _input
                event.complete = input.complete
                event.skip = input.complete // member input need not be in event scheme
                event.useDialogCache = input.useDialogCache
            }
            if(event.complete)
                break
        case 'dialog':
            // dialog from inputs cascading down already have iteration information
            if(dialog && Object.keys(dialog).length)
                dialog.dialog = await mEventDialog(llm, experience, event)
        case 'character':
            if(character && Object.keys(character).length)
                character = await mEventCharacter(llm, experience, character)
        case 'stage':
            if(stage && Object.keys(stage).length)
                stage = mEventStage(llm, experience, stage)
            event.complete = event.complete ?? true // when `false`, value retained
            break
        default: // error/failure
            throw new Error('Event action not recognized')
    }
    event.experienceId = location.experienceId // not native, since redundant
    event.sceneId = location.sceneId // not native, since redundant
    /* log to experience */
    experience.events.push(event)
    /* update location pointers */
    experience.location.eventId = event.id
    experience.location.iteration = event.complete ? 0 : location.iteration + 1
    return mSanitizeEvent(event)
}
/**
 * Returns a processed stage event.
 * @todo - add LLM usage data to conversation.
 * @todo - when `action==='stage'`, deprecate effects and actor
 * @module
 * @public
 * @param {LLMServices} llm - OpenAI object currently.
 * @param {Experience} experience - Experience class instance.
 * @param {Object} stage - `Event.stage` data object.
 * @returns {Object} - Synthetic Stage object.
 */
function mEventStage(llm, experience, stage){
    if(!stage)
        return // no stage to parse
    if((stage.type??'script')!=='script'){
        console.log('Dynamic stage effects not yet implemented')
        stage.type = 'script' // force standardization
    }
    return stage
}
/**
 * Starts or continues experience with avatar functionality as director/puppeteer. Everything is herein mutated and returned as one final experience instructionset to front-end.
 * @todo - allow auto-skip to scene/event?
 * @todo - Branching and requirements for scene entry and completion
 * @todo - ExperienceScene and ExperienceEvent should be classes?
 * @module
 * @public
 * @param {AgentFactory} factory - AgentFactory object
 * @param {object} llm - ai interface object
 * @param {Experience} experience - Experience object
 * @param {object} memberInput - Member input
 * @returns {Promise<Array>} - An array of ExperienceEvent objects.
 */
async function mExperiencePlay(factory, llm, experience, memberInput){
    // okay, here is thinking - the living experience stores the important outcomes, and if they need to be relived, a different call is made to pull from the lived event in the /living experience
    // always pitch current event, and no other when "repeated"
    const { sceneId, eventId } = experience.location
    let currentEvent = experience.event(eventId)
    const currentScene = experience.scene(sceneId)
    let eventIndex = currentScene.events.findIndex(event => event.id === currentEvent.id)
    if(eventIndex === -1)
        throw new Error('Event not found in scene')
    const eventSequence = []
    const maxSceneIndex = currentScene.events.length - 1
    let sceneComplete = true // presume to display entire scene from eventIndex
    while(eventIndex <= maxSceneIndex){
        const _event = new (factory.experienceEvent)(currentScene.events[eventIndex])
        const event = await mEventProcess(llm, experience, _event, memberInput)
        if(memberInput)
            memberInput = null // clear for next event
        if(event.skip) // currently no occasion
            console.log('mExperiencePlay: event skipped, not presented to frontend')
        else
            eventSequence.push(event)
        if(!event.complete){
            sceneComplete = false
            break
        } // INPUT event incomplete
        eventIndex++
    }
    /* end-of-scene */
    if(sceneComplete){
        // @stub - check for additional scene requirements (beyond being finished)
        // @stub - check for scene branching
        const nextScene = experience.sceneNext(sceneId)
        if(nextScene){
            eventSequence.push({
                action: 'end',
                complete: true,
                id: sceneId,
                experienceId: experience.id,
                sceneId: sceneId,
                title: currentScene.title,
                type: 'scene',
            }) // provide marker for front-end [end of event sequence]; begin next scene with next request
            experience.location.sceneId = nextScene.id
            experience.location.eventId = nextScene.events[0].id
        } else {
            /* end-of-experience */
            const { goal, id: experienceId, name: experienceName, title, } = experience
            const name = experienceName ?? 'MyLife Experience'
            eventSequence.push({
                action: 'end',
                complete: true,
                goal: goal,
                id: experienceId,
                experienceId: experienceId,
                name: name,
                title: title ?? name,
                type: 'experience',
            }) // provide marker for front-end [end of event sequence]
            experience.location.completed = true
        }
    }
    experience.events.push(...eventSequence)
    return eventSequence
}
/**
 * Takes an experience document and converts it to use by frontend. Also filters out any inappropriate experiences.
 * @param {array<object>} experiences - Array of Experience document objects.
 * @returns {array<object>} - Array of Experience shorthand objects.
 * @property {boolean} autoplay - Whether or not the experience is autoplay.
 * @property {string} description - The description of the experience.
 * @property {guid} id - The id of the experience.
 * @property {string} name - The name of the experience.
 * @property {string} purpose - The purpose of the experience.
 * @property {boolean} skippable - Whether or not the experience is skippable
 */
function mExperiences(experiences){
    return experiences
        .filter(experience=>{
            const { status, dates, } = experience
            const { end, runend, runEnd, runstart, runStart, start, } = dates
            const now = Date.now()
            const startDate = start || runstart || runStart
                ? new Date(start ?? runstart ?? runStart).getTime()
                : now
            const endDate = end || runend || runEnd
                ? new Date(end ?? runend ?? runEnd).getTime()
                : now          
            return status==='active'
                && startDate <= now 
                && endDate >= now
        })
        .map(experience=>{ // map to display versions
            const { autoplay=false, description, id, name, purpose, skippable=true,  } = experience
            return {
                autoplay,
                description,
                id,
                name,
                purpose,
                skippable,
            }
        })
}
/**
 * Starts Experience.
 * @todo - sceneId and eventId start forms
 * @param {Avatar} avatar - Avatar object.
 * @param {AgentFactory} factory - AgentFactory object.
 * @param {guid} experienceId - Experience id.
 * @param {object} avatarExperienceVariables - Experience variables object from Avatar class definition.
 * @returns {Promise} - Promise indicating successfully mutated avatar.
 */
async function mExperienceStart(avatar, factory, experienceId, avatarExperienceVariables){
    let _experience = await factory.getExperience(experienceId) // database object
    if(!_experience)
        throw new Error('Experience not found')
    /* hydrate experience */
    avatar.mode = 'experience'
    avatar.experience = await ( new (factory.experience)(_experience) )
        .init()
    const { experience, mode } = avatar
    const { id, scenes } = experience
    if(id!==experienceId)
        throw new Error('Experience failure, unexpected id mismatch.')
    experience.cast = await mCast(factory, experience.cast) // hydrates cast data
    console.log('mExperienceStart::experience', experience.cast[0].inspect(true))
    experience.events = []
    experience.location = {
        experienceId: experience.id,
        eventId: experience.scenes[0].events[0].id,
        iteration: 0,
        sceneId: experience.scenes[0].id,
    }
    experience.navigation = mNavigation(scenes) // hydrate scene data for navigation
    experience.variables = avatarExperienceVariables
    /* assign living experience */
    let [memberDialog, scriptDialog] = await Promise.all([
        avatar.createConversation('experience'),
        avatar.createConversation('dialog')
    ]) // async cobstruction
    experience.memberDialog = memberDialog
    experience.scriptDialog = scriptDialog
}
/**
 * Gets bot by id.
 * @module
 * @param {object} avatar - Avatar instance.
 * @param {string} _botId - Bot id
 * @returns {object} - Bot object
 */
function mFindBot(avatar, _botId){
    return avatar.bots
        .filter(_bot=>{ return _bot.id==_botId })
        [0]
}
/**
 * Returns simple micro-category after logic mutation.
 * @module
 * @param {string} _category text of category
 * @returns {string} formatted category
 */
function mFormatCategory(_category){
    return _category
        .trim()
        .slice(0, 128)  //  hard cap at 128 chars
        .replace(/\s+/g, '_')
        .toLowerCase()
}
/**
 * Returns MyLife-version of chat category object
 * @module
 * @param {object} _category - local front-end category { category, contributionId, question/message/content }
 * @returns {object} - local category { category, contributionId, content }
 */
function mGetChatCategory(_category) {
    const _proposedCategory = {
        category: '',
        contributionId: undefined,
        content: undefined,
    }
    if(_category?.category && _category.category.toLowerCase() !== 'off'){
        _proposedCategory.category = mFormatCategory(_category.category)
        _proposedCategory.contributionId = _category.contributionId
        _proposedCategory.content = 
            _category?.question??
            _category?.message??
            _category?.content // test for undefined
    }
    return _proposedCategory
}
/**
 * Returns set of Greeting messages, dynamic or static.
 * @param {object} bot - The bot object.
 * @param {boolean} dynamic - Whether to use dynamic greetings.
 * @param {*} llm - The LLM object.
 * @param {*} factory - The AgentFactory object.
 * @returns {Promise<Message[]>} - The array of messages to respond with.
 */
async function mGreeting(bot, dynamic=false, llm, factory){
    const processStartTime = Date.now()
    const { bot_id, bot_name, id, greetings, greeting, thread_id, } = bot
    const failGreeting = [`Hello! I'm concerned that there is something wrong with my instruction-set, as I was unable to find my greetings, but let's see if I can get back online.`, `How can I be of help today?`]
    const greetingPrompt = factory.isMyLife
        ? `Greet this new user with a hearty hello, and let them know that you are here to help them understand MyLife and the MyLife platform. Begin by asking them about something that's important to them--based on their response, explain how MyLife can help them.`
        : `Greet me with a hearty hello as we start a new session, and let me know either where we left off, or how we should start for today!`
    const QGreetings = [
        `Hi, I'm Q, so nice to meet you!`,
        `To get started, tell me a little bit about something or someone that is really important to you &mdash; or ask me a question about MyLife.`
    ]
    const botGreetings = greetings
        ? greetings
        : greeting
            ? [greeting]
            : factory.isMyLife
                ? QGreetings
                : null
    let messages = botGreetings?.length && !dynamic
        ? botGreetings
        : await llm.getLLMResponse(thread_id, bot_id, greetingPrompt, factory) 
    if(!messages?.length)
        messages = failGreeting
    messages = messages
        .map(message=>new (factory.message)({
            being: 'message',
            content: message,
            thread_id,
            role: 'assistant',
            type: 'greeting'
        }))
        .map(message=>mPruneMessage(bot, message, 'greeting', processStartTime))
    return messages
}
/**
 * Include help preamble to _LLM_ request, not outbound to member/guest.
 * @todo - expand to include other types of help requests, perhaps more validation.
 * @param {string} type - The type of help request.
 * @param {boolean} isMyLife - Whether the request is from MyLife.
 * @returns {string} - The help preamble to be included.
 */
function mHelpIncludePreamble(type, isMyLife){
    switch(type){
        case 'account':
        case 'membership':
            if(isMyLife)
                throw new Error(`Members can only request information about their own accounts.`)
            return 'Following help request is for MyLife member account information or management:\n'
        case 'interface':
            return 'Following question is expected to be about MyLife Member Platform Interface:\n'
        case 'general':
        case 'help':
        default:
            return 'Following help request is about MyLife in general:\n'
    }
}
/**
 * Get experience scene navigation array.
 * @getter
 * @returns {Object[]} - The scene navigation array for the experience.
 * @property {Guid} id - The scene id.
 * @property {string} description - The scene description.
 * @property {Object[]} events - The scene events. @stub not currently included
 * @property {number} order - The scene order, default=1.
 * @property {boolean} required - Whether the scene is required, default=false.
 * @property {boolean} skippable - Whether the scene is skippable, default=true.
 * @property {string} title - The scene name.
 */
function mNavigation(scenes){
    return scenes
        .map(scene=>{
            const { backdrop, hooks, description, id, order, required=false, skippable=true, title=`untitled`, type, } = scene
            return {
                backdrop,
                id,
                description,
                order,
                required,
                skippable,
                title,
                type,
            }
        })
        .sort((a,b)=>{
            return (a.order ?? 0) - (b.order ?? 0)
        })
}
function mPruneBot(assistantData){
    const { bot_id, bot_name: name, description, id, purpose, type, } = assistantData
    return {
        bot_id,
        name,
        description,
        id,
        purpose,
        type,
    }
}
/**
 * returns simple micro-message with category after logic mutation. 
 * Currently tuned for openAI gpt-assistant responses.
 * @todo - revamp as any of these LLMs can return JSON or run functions for modes.
 * @module
 * @private
 * @param {object} bot - The bot object, usually active.
 * @param {string} message - The text of LLM message.
 * @param {string} type - The type of message, defaults to chat.
 * @param {number} processStartTime - The time the process started, defaults to function call.
 * @returns {object} - The bot-included message object.
 */
function mPruneMessage(bot, message, type='chat', processStartTime=Date.now()){
    /* parse message */
    const { bot_id: activeBotAIId, id: activeBotId, } = bot
    let agent='server',
        category,
        contributions=[],
        purpose=type,
        response_time=Date.now()-processStartTime
    const { content: messageContent, thread_id, } = message
    const content = Array.isArray(messageContent)
        ? messageContent.reduce((acc, item) => {
            if (item?.type==='text' && item?.text?.value) {
                acc += item.text.value + '\n'
            }
            return acc
        }, '')
            .replace(/\n{2,}/g, '\n')
        : messageContent
    message = new Marked().parse(content)
    const messageResponse = {
        activeBotId,
        activeBotAIId,
        agent,
        category,
        contributions,
        message,
        purpose,
        response_time,
        thread_id,
        type,
    }
    return messageResponse
}
/**
 * Flattens an array of messages into a single frontend-consumable message.
 * @param {object} bot - The bot object, usually active.
 * @param {Object[]} messages - The array of messages to prune.
 * @param {string} type - The type of message, defaults to chat.
 * @param {number} processStartTime - The time the process started, defaults to function call.
 * @returns {object} - Concatenated message object.
 */
function mPruneMessages(bot, messageArray, type='chat', processStartTime=Date.now()){
    if(!messageArray.length)
        throw new Error('No messages to prune')
    const prunedMessages = messageArray
        .map(message=>mPruneMessage(bot, message, type, processStartTime))
    const messageContent = prunedMessages
        .map(message=>message.message)
        .join('\n')
    const message = {
        ...prunedMessages[0],
        message: messageContent,
    }
    return message
}
/**
 * Replaces variables in prompt with Experience values.
 * @todo - variables should be back populated to experience, confirm
 * @todo - events could be identified where these were input if empty
 * @module
 * @private
 * @param {string} prompt - Dialog prompt, replace variables.
 * @param {string[]} variableList - List of variables to replace.
 * @param {object} variableValues - Object with variable values.
 * @returns {string} - Dialog prompt with variables replaced.
 */
function mReplaceVariables(prompt, variableList, variableValues){
    variableList.forEach(keyName=>{
        const value = variableValues[keyName]
        if(value)
            prompt = prompt.replace(new RegExp(`@@${keyName}`, 'g'), value)
    })
    return prompt
}
/**
 * Returns a sanitized event.
 * @module
 * @param {ExperienceEvent} event - Event object.
 * @returns {object} - Synthetic Event object.
 */
function mSanitizeEvent(event){
    const { action, character, breakpoint, complete, dialog, experienceId, id, input, order, sceneId, skip=false, stage, type, useDialogCache,  } = event
    return {
        action,
        character,
        breakpoint,
        complete,
        dialog,
        experienceId,
        id,
        input,
        order,
        sceneId,
        skip,
        stage,
        type,
        useDialogCache,
    }
}
function mValidateMode(_requestedMode, _currentMode){
    if(!mAvailableModes.includes(_requestedMode))
        throw new Error('Invalid interface mode request. Mode not altered.')
    switch(_requestedMode){
        case 'admin':
            console.log('Admin interface not currently implemented. Mode not altered.')
            return _currentMode
        case 'experience':
        case 'standard':
        case 'restore':
        default:
            return _requestedMode
    }
}
/**
 * Validate provided registration id.
 * @private
 * @param {object} activeBot - The active bot object.
 * @param {AgentFactory} factory - AgentFactory object.
 * @param {Guid} validationId - The registration id.
 * @returns {Promise<object>} - The validation result: { messages, success, }.
 */
async function mValidateRegistration(activeBot, factory, validationId){
    /* validate structure */
    if(!factory.isMyLife)
        throw new Error('FAILURE::validateRegistration()::Only MyLife may validate registrations.')
    if(!factory.globals.isValidGuid(validationId))
        throw new Error('FAILURE::validateRegistration()::Invalid validation id.')
    /* validate validationId */
    let message,
        registrationData = { id: validationId },
        success = false
    const registration = await factory.validateRegistration(validationId)
    console.log('mValidateRegistration::registration', registration)
    const messages = []
    const failureMessage = `I\'m sorry, but I\'m currently unable to validate your registration id:<br />${ validationId }.<br />I\'d be happy to talk with you more about MyLife, but you may need to contact member support to resolve this issue.`
    /* determine eligibility */
    if(registration){
        const { avatarNickname, being, email: registrationEmail, humanName, } = registration
        const eligible = being==='registration'
            && factory.globals.isValidEmail(registrationEmail)
        if(eligible){
            const successMessage = `Hello and _thank you_ for your registration, ${ humanName }!\nI'm Q, the ai-representative for MyLife, and I'm excited to help you get started, so let's do the following:\n1. Verify your email address\n2. set up your account\n3. get you started with your first MyLife experience!\n\nSo let me walk you through the process. In the chat below, please enter the email you registered with and hit the **submit** button!`
            message = mCreateSystemMessage(activeBot, successMessage, factory)
            registrationData.avatarNickname = avatarNickname
            registrationData.email = registrationEmail
            registrationData.humanName = humanName
            success = true
        }
    }
    if(!message){
        message = mCreateSystemMessage(activeBot, failureMessage, factory)
    }
    if(message)
        messages.push(message)
    return { registrationData, messages, success, }
}
/* exports */
export default Avatar