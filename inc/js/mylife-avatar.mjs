import { Marked } from 'marked'
import EventEmitter from 'events'
import AssetAgent from './agents/system/asset-agent.mjs'
import BotAgent from './agents/system/bot-agent.mjs'
import CollectionsAgent from './agents/system/collections-agent.mjs'
import EvolutionAgent from './agents/system/evolution-agent.mjs'
import ExperienceAgent from './agents/system/experience-agent.mjs'
import LLMServices from './mylife-llm-services.mjs'
/* module constants */
const mAllowSave = JSON.parse(
    process.env.MYLIFE_DB_ALLOW_SAVE
        ?? 'false'
)
const mAvailableModes = ['standard', 'admin', 'evolution', 'experience', 'restoration']
const mMigrateThreadOnVersionChange = false // hack currently to avoid thread migration on bot version change when it's not required, theoretically should be managed by Bot * Version
/**
 * @class - Avatar
 * @extends EventEmitter
 * @description An avatar is a digital self proxy of Member. Not of the class but of the human themselves - they are a one-to-one representation of the human, but the synthetic version that interopts between member and internet when inside the MyLife platform. The Avatar is the manager of the member experience, and is the primary interface with the AI (aside from when a bot is handling API request, again we are speaking inside the MyLife platform).
 * @todo - deprecate `factory` getter
 */
class Avatar extends EventEmitter {
    #assetAgent
    #botAgent
    #collectionsAgent
    #evolver
    #experienceAgent
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
    #livingMemory
    #llmServices
    #mode = 'standard' // interface-mode from module `mAvailableModes`
    #nickname // avatar nickname, need proxy here as g/setter is "complex"
    #vectorstoreId // vectorstore id for avatar
    /**
     * @constructor
     * @param {MyLifeFactory|AgentFactory} factory - The factory on which avatar relies for all service interactions.
     * @param {LLMServices} llmServices - The LLM services object
     */
    constructor(factory, llmServices){
        super() // EventEmitter
        this.#factory = factory
        this.#llmServices = llmServices
        this.#assetAgent = new AssetAgent(this.#factory, this.#llmServices)
        this.#botAgent = new BotAgent(this.#factory, this.#llmServices)
        this.#collectionsAgent = new CollectionsAgent(this.#factory, this.#llmServices)
        this.#experienceAgent = new ExperienceAgent({}, this.#botAgent, this.#llmServices, this.#factory, this)
    }
    /* public functions */
    /**
     * Initialize the Avatar class.
     * @todo - create class-extender specific to the "singleton" MyLife avatar
     * @todo - rethink architecture on this/#factory and also evolver, as now would manifest more as vectorstore object
     * @async
     * @public
     * @returns {Promise} Promise resolves to this Avatar class instantiation
     */
    async init(){
        await mInit(this.#factory, this.#llmServices, this, this.#botAgent, this.#assetAgent, this.#vectorstoreId) // mutates and populates
        /* experience variables */
        this.#experienceGenericVariables = mAssignGenericExperienceVariables(this.#experienceGenericVariables, this)
        return this
    }
    /**
     * Get a Bot instance by id.
     * @public
     * @param {Guid} bot_id - The bot id
     * @returns {Promise<Bot>} - The bot object from memory
     */
    bot(bot_id){
        const Bot = this.#botAgent.bot(bot_id)
        return Bot
    }
    /**
     * Processes and executes incoming chat request.
     * @public
     * @param {string} message - The chat message content
     * @param {Guid} itemId - The active collection-item id (optional)
     * @returns {object} - The response object { instruction, responses, success, }
    */
    async chat(message, itemId){
        /* validate request */
        if(!message)
            throw new Error('No message provided in context')
        const originalMessage = message
        this.backupResponse = {
            message: `I received your request to chat, and sent the request to the central intelligence, but no response was received. Please try again, as the issue is likely aberrant.`,
            type: 'system',
        }
        /* execute request */
        if(this.globals.isValidGuid(itemId)){
            // @todo - check if item exists in memory, fewer pings and inclusions overall
            let { summary, } = await this.#factory.item(itemId)
            if(summary?.length)
                message = `possible **update-summary-request**: itemId=${ itemId }\n`
                    + `**member-update-request**:\n`
                    + message
                    + `\n**current-summary-in-database**:\n`
                    + summary
        }
        const Conversation = await this.activeBot.chat(message, originalMessage, mAllowSave, this)
        const responses = mPruneMessages(this.activeBotId, Conversation.getMessages() ?? [], 'chat', Conversation.processStartTime)
        /* respond request */
        const response = {
            instruction: this.frontendInstruction,
            responses,
            success: true,
        }
        delete this.frontendInstruction
        delete this.backupResponse
        return response
    }
    /**
     * Chat with an open agent, bypassing specific or active bot.
     * @param {Conversation} Conversation - The conversation instance
     * @returns {Promise<Object>} - Response object: { instruction, responses, success, }
     * @note - Conversation instance is altered in place
     */
    async chatAgentBypass(Conversation){
        if(!this.isMyLife)
            throw new Error('Agent bypass only available for MyLife avatar.')
		await this.#botAgent.chat(Conversation, mAllowSave, this)
        const responses = mPruneMessages(this.activeBotId, Conversation.getMessages(), 'chat', Conversation?.processStartTime)
        /* respond request */
        const response = {
            instruction: this.frontendInstruction,
            responses,
            success: true,
        }
        delete this.frontendInstruction
        delete this.backupResponse
        return response
    }
    /**
     * Get member collection items.
     * @todo - trim return objects based on type
     * @param {string} type - The type of collection to retrieve, `false`-y = all.
     * @returns {array} - The collection items with no wrapper.
     */
    async collections(type){
        if(type==='file'){
            await this.#assetAgent.init(this.#vectorstoreId) // bypass factory for files
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
     * Start a new conversation.
     * @param {String} type - The type of conversation, defaults to `chat`
     * @param {String} form - The form of conversation, defaults to `member-avatar`
     * @returns {Promise<Conversation>} - The Conversation instance
     */
	async conversationStart(type='chat', form='member-avatar'){
        const Conversation = await this.#botAgent.conversationStart(type, form)
        return Conversation
    }
    /**
     * Create a new bot.
     * @async
     * @public
     * @param {Object} botData - The bot data object, requires type.
     * @returns {Object} - The new bot.
     */
    async createBot(botData){
        const Bot = await this.#botAgent.botCreate(botData)
        const bot = Bot.bot
        return bot
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
        return await this.#factory.deleteItem(id)
    }
    /**
     * End the living memory, if running.
     * @async
     * @public
     * @todo - save conversation fragments
     * @returns {void}
     */
    async endMemory(){
        // @stub - save conversation fragments */
        this.#livingMemory = null
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
        try {
            if(this.isMyLife) // @stub - allow guest experiences
                throw new Error(`MyLife avatar can neither conduct nor end experiences`)
            if(mode!=='experience')
                throw new Error(`Avatar is not currently in an experience; mode: ${ mode }`)
            if(this.experience?.id!==experienceId)
                throw new Error(`Avatar is not currently in the requested experiece; experience: ${ experienceId }`)
        } catch(error) {
            console.log('ERROR::experienceEnd()', error.message)
            return
        }
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
     * Specified by id, returns the pruned Bot.
     * @param {Guid} id - The Bot id
     * @returns {object} - The pruned Bot object
     */
    getBot(bot_id){
        const bot = this.#botAgent.bot(bot_id)?.bot
        return bot
    }
    /**
     * Returns pruned Bots for Member Avatar.
     * @returns 
     */
    getBots(){
        const bots = this.bots
            .map(Bot=>Bot.bot)
        return bots
    }
    /**
     * Gets Conversation object. If no thread id, creates new conversation.
     * @param {string} thread_id - openai thread id (optional)
     * @param {Guid} bot_id - The bot id (optional)
     * @returns {Conversation} - The conversation object.
     */
    getConversation(thread_id, bot_id){
        const conversation = this.conversations
            .filter(c=>(thread_id?.length && c.thread_id===thread_id) || (bot_id?.length && c.bot_id===bot_id))
            ?.[0]
        return conversation
    }
    /**
     * Returns all conversations of a specific-type stored in memory.
     * @param {string} type - Type of conversation: chat, experience, dialog, inter-system, etc.; defaults to `chat`.
     * @returns {Conversation[]} - The array of conversation objects.
     */
    getConversations(type='chat'){
        return this.conversations
            .filter(_=>_?.type===type)
            .map(conversation=>(mPruneConversation(conversation)))
    }
    /**
     * Get a static or dynamic greeting from active bot.
     * @param {boolean} dynamic - Whether to use LLM for greeting
     * @returns {Array} - The greeting message(s) string array in order of display
     */
    async greeting(dynamic=false){
        const greetings = mPruneMessages(this.#botAgent.activeBotId, await this.#botAgent.greeting(dynamic), 'greeting')
        return greetings
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
        const conversation = this.getConversation(thread_id)
        const helpResponseArray = await this.factory.help(thread_id, bot_id, helpRequest)
        conversation.addMessages(helpResponseArray)
        if(mAllowSave)
            conversation.save()
        else
            console.log('helpRequest::BYPASS-SAVE', conversation.message.content)
        const response = mPruneMessages(this.activeBotId, helpResponseArray, 'help', processStartTime)
        return response
    }
    /**
     * Manages a collection item's functionality.
     * @param {object} item - The item data object.
     * @param {string} method - The http method used to indicate response.
     * @returns {Promise<object>} - Returns void if item created successfully.
     */
    async item(item, method){
        const { globals, } = this
        let { id, } = item
        let success = false
        switch(method.toLowerCase()){
            case 'delete':
                if(globals.isValidGuid(id))
                    item = await this.#factory.deleteItem(id)
                success = item ?? success
                break
            case 'post': /* create */
                item = await this.#factory.createItem(item)
                id = item?.id
                success = this.globals.isValidGuid(id)
                break
            case 'put': /* update */
                if(globals.isValidGuid(id)){
                    item = await this.#factory.updateItem(item)
                    success = this.globals.isValidGuid(item?.id)
                }
                break
            default:
                console.log('item()::default', item)
                break
        }
        return {
            item: mPruneItem(item),
            success,
        }
    }
    /**
     * Migrates a bot to a new, presumed combined (with internal or external) bot.
     * @param {Guid} bot_id - The bot id
     * @returns {Promise<Bot>} - The migrated Bot instance
     */
    async migrateBot(bot_id){
        const migration = await this.#botAgent.migrateBot(bot_id)
        return migration
    }
    /**
     * Migrates a chat conversation from an old thread to a newly created (or identified) destination thread.
     * @param {string} thread_id - Conversation thread id in OpenAI
     * @returns {Conversation} - The migrated conversation object
     */
    async migrateChat(bot_id){
        const success = await this.#botAgent.migrateChat(bot_id)
        const response = {
            responses: [success
                ? {
                    agent: 'server',
                    message: `I have successfully migrated this conversation to a new thread.`,
                    type: 'chat',
                }
                : {
                    agent: 'server',
                    message: `I'm sorry - I encountered an error while trying to migrate this conversation; please try again.`,
                    type: 'chat',
                }
            ],
            success,
        }
        return response
    }
    /**
     * Given an itemId, obscures aspects of contents of the data record. Obscure is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM.
     * @param {Guid} iid - The item id
     * @returns {Object} - The obscured item object
     */
    async obscure(iid){
        const updatedSummary = await this.activeBot.obscure(iid)
        this.frontendInstruction = {
            command: 'updateItemSummary',
            itemId: iid,
            summary: updatedSummary,
        }
        return {
            instruction: this.frontendInstruction,
            responses: [{
                agent: 'server',
                message: `I have successfully obscured your content.`,
            }],
            success: true,
        }
    }
    /**
     * Register a candidate in database.
     * @param {object} candidate - The candidate data object.
     * @returns {object} - The registration object.
     */
    async registerCandidate(candidate){
        const registration = await this.#factory.registerCandidate(candidate)
        delete registration.mbr_id
        delete registration.passphrase
        return registration
    }
    /**
     * Reliving a memory is a unique MyLife `experience` that allows a user to relive a memory from any vantage they choose.
     * @param {Guid} iid - The item id.
     * @param {string} memberInput - Any member input.
     * @returns {Object} - livingMemory engagement object (i.e., includes frontend parameters for engagement as per instructions for included `portrayMemory` function in LLM-speak): { error, inputs, itemId, messages, processingBotId, success, }
     */
    async reliveMemory(iid, memberInput){
        const item = await this.#factory.item(iid)
        const { id, } = item
        if(!id)
            throw new Error(`item does not exist in member container: ${ iid }`)
        const narration = await mReliveMemoryNarration(item, memberInput, this.#botAgent, this)
        return narration
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
     * Member request to retire a bot.
     * @param {Guid} bot_id - The id of Bot to retire
     * @returns {object} - The Response object: { instruction, responses, success, }
     */
    async retireBot(bot_id){
        const success = await this.#botAgent.deleteBot(bot_id)
        const response = {
            instruction: {
                command: success ? 'removeBot' : 'error',
                id: bot_id,
            },
            responses: [success
                ? {
                    agent: 'server',
                    message: `I have removed this bot from the team.`,
                    type: 'chat',
                }
                : {
                    agent: 'server',
                    message: `I'm sorry - I encountered an error while trying to retire this bot; please try again.`,
                    type: 'system',
                }
            ],
            success,
        }
        return response
    }
    /**
     * Retire a Bot, deleting altogether.
     * @param {Guid} bot_id - The bot id
     * @returns {object} - The response object { instruction, responses, success, }
     */
    async retireBot(bot_id){
        if(!this.globals.isValidGuid(bot_id))
            throw new Error(`Invalid bot id: ${ bot_id }`)
        const success = await this.#botAgent.botDelete(bot_id)
        const response = {
            instruction: {
                command: success ? 'retireBot' : 'error',
                id: bot_id,
            },
            responses: [success
                ? {
                    agent: 'server',
                    message: `I have removed this bot from the team.`,
                    type: 'chat',
                }
                : {
                    agent: 'server',
                    message: `I'm sorry - I encountered an error while trying to retire this bot; please try again.`,
                    type: 'system',
                }
            ],
            success,
        }
        return response
    }
    /**
     * Currently only proxy for `migrateChat`.
     * @param {string} bot_id - Bot id with Conversation to retire
     * @returns {object} - The response object { instruction, responses, success, }
     */
    async retireChat(bot_id){
        const success = await this.#botAgent.migrateChat(bot_id)
        /* respond request */
        const response = success
            ? { /* @todo - add frontend instructions to remove migrateChat button */
                instruction: null,
                responses: [{
                    agent: 'server',
                    message: `I have successfully retired this conversation.`,
                    type: 'chat',
                }],
                success: true,
            }
            : {
                instruction: null,
                responses: [{
                    agent: 'server',
                    message: `I'm sorry - I encountered an error while trying to retire this conversation; please try again.`,
                    type: 'chat',
                }],
                success: false,
            }
        return response
    }
    /**
     * Gets the list of shadows.
     * @returns {Object[]} - Array of shadow objects.
     */
    async shadows(){
        return await this.#factory.shadows()
    }
    /**
     * Summarize the file indicated.
     * @param {string} fileId 
     * @param {string} fileName 
     * @param {number} processStartTime 
     * @returns {Object} - The response object { error, instruction, responses, success, }
     */
    async summarize(fileId, fileName, processStartTime=Date.now()){
        /* validate request */
        let instruction,
            responses = [],
            success = false
        this.backupResponse = {
            message: `I received your request to summarize, but an error occurred in the process. Perhaps try again with another file.`,
            type: 'system',
        }
        /* execute request */
        responses.push(...await this.#botAgent.summarize(fileId, fileName, processStartTime))
        /* respond request */
        if(!responses?.length)
            responses.push(this.backupResponse)
        else {
            instruction = {
                command: 'updateFileSummary',
                itemId: fileId,
            }
            responses = mPruneMessages(this.avatar.id, responses, 'mylife-file-summary', processStartTime)
            success = true
        }
        return {
            instruction,
            responses,
            success,
        }
    }
    /**
     * Get a specified team, its details and _instanced_ bots, by id for the member.
     * @param {string} teamId - The team id
     * @returns {object} - Team object
     */
    team(teamId){
        this.#botAgent.setActiveTeam(teamId)
        const team = this.#botAgent.activeTeam
        return team
    }
    /**
     * Get a list of available teams and their default details.
     * @returns {Object[]} - List of team objects.
     */
    teams(){
        const teams = this.#botAgent.teams
        return teams
    }
    /**
     * Update a specific bot.
     * @async
     * @param {Object} botData - Bot data to set
     * @returns {Promise<Object>} - The updated bot
     */
    async updateBot(botData){
        const Bot = await this.#botAgent.updateBot(botData)
        return Bot.bot
    }
    /**
     * Update instructions for bot-assistant based on type. Default updates all LLM pertinent properties.
     * @async
     * @param {string} id - The id of bot to update
     * @param {boolean} migrateThread - Whether to migrate the thread to the new bot, defaults to `true`
     * @returns {object} - The updated bot object
     */
    async updateBotInstructions(bot_id=this.activeBot.id){
        const Bot = await this.#botAgent.updateBotInstructions(bot_id, mMigrateThreadOnVersionChange)
        return Bot.bot
    }
    /**
     * Upload files to Member Avatar.
     * @param {File[]} files - The array of files to upload.
     * @returns {boolean} - true if upload successful.
     */
    async upload(files){
        await this.#assetAgent.upload(files)
        const { vectorstoreFileList, } = this.#assetAgent
        return {
            uploads: files,
            files: vectorstoreFileList,
            success: true,
        }
    }
    /**
     * Validate registration id.
     * @todo - move to MyLife only avatar variant.
     * @param {Guid} validationId - The registration id.
     * @returns {Promise<Object[]>} - Array of system messages.
     */
    async validateRegistration(validationId){
        const { messages, registrationData, success, } = await mValidateRegistration(this.activeBot, this.#factory, validationId)
        return messages
    }
    /* getters/setters */
    /**
     * Get the active bot. If no active bot, return this as default chat engine.
     * @getter
     * @returns {object} - The active bot.
     */
    get activeBot(){
        return this.#botAgent.activeBot
    }
    /**
     * Get the active bot id.
     * @getter
     * @returns {string} - The active bot id.
     */
    get activeBotId(){
        return this.#botAgent.activeBotId
    }
    /**
     * Set the active bot id. If not match found in bot list, then defaults back to this.id (avatar).
     * @setter
     * @param {string} bot_id - The requested bot id
     * @returns {void}
     */
    set activeBotId(bot_id){
        this.#botAgent.setActiveBot(bot_id)
    }
    get activeBotNewestVersion(){
        const { type, } = this.activeBot
        const newestVersion = this.#factory.botInstructionsVersion(type)
        return newestVersion
    }
    get activeBotVersion(){
        const { version=1.0, } = this.activeBot
        return version
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
     * Get the personal avatar bot.
     * @getter
     * @returns {object} - The personal avatar bot
     */
    get avatar(){
        return this.#botAgent.avatar
    }
    /**
     * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
     * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
     * @getter
     * @returns {string} The object being the avatar is emulating.
    */
    get being(){  
        return 'human'
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
     * Returns Member Avatar's Bot instances.
     * @getter
     * @returns {Bot[]} - Array of Bot instances
     */
    get bots(){
        return this.#botAgent.bots
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
     * Get the cast.
     * @getter
     * @returns {array} - The cast.
     */
    get cast(){
        return this.experience.cast
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
        const conversations = this.bots
            .map(bot=>bot.conversation)
            .filter(Boolean)
        return conversations
    }
    /**
     * Get the datacore.
     * @getter
     * @returns {object} - The Member's datacore.
     */
    get core(){
        return this.#factory.core
    }
    get dob(){
        return this.#factory.dob
    }
    get evolver(){
        return this.#evolver
    }
    set evolver(evolver){
        if(!(evolver instanceof EvolutionAgent))
        this.#evolver = evolver
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
     * Set the experiences lived.
     * @setter
     * @param {array} livedExperiences - The new experiences lived.
     * @returns {void}
     */
    set experiencesLived(livedExperiences){
        if(!Array.isArray(livedExperiences))
            throw new Error('Experiences lived must be an array.')
        this.#livedExperiences = livedExperiences
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
        const bots = this.getBots()
            .filter(bot=>bot.type==='help')
        return bots
    }
    /**
     * Test whether avatar session is creating an account.
     * @getter
     * @returns {boolean} - Avatar is in `accountCreation` mode (true) or not (false).
     */
    get isCreatingAccount(){
        return this.#factory.isCreatingAccount
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
     * Test whether avatar is `validating` in session.
     * @getter
     * @returns {boolean} - Avatar is in `registering` mode (true) or not (false).
     */
    get isValidating(){
        return this.#factory.isValidating
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
        return this.#factory.mbr_id_id
    }
    /**
     * Get the system name portion of member id.
     * @getter
     * @returns {guid} - The member's system name.
     */
    get mbr_sysName(){
        return this.#factory.mbr_name
    }
    /**
     * Gets first name of member from `#factory`.
     * @getter
     * @returns {guid} - The member's core guid.
     */
    get memberFirstName(){
        return this.#factory.memberFirstName
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
    /**
     * Get the `active` reliving memory.
     * @getter
     * @returns {object[]} - The active reliving memories
     */
    get livingMemory(){
        return this.#livingMemory
            ?? {}
    }
    /**
     * Set the `active` reliving memory.
     * @setter
     * @param {Object} livingMemory - The new active reliving memory
     * @returns {void}
     */
    set livingMemory(livingMemory){
        this.#livingMemory = livingMemory
    }
    get registrationId(){
        return this.#factory.registrationId
    }
    /**
     * Get vectorstore id.
     * @getter
     * @returns {string} - The vectorstore id.
     */
	get vectorstore_id(){
		return this.#vectorstoreId
	}
    /**
     * Set vectorstore id, both in memory and storage.
     * @setter
     * @param {string} vectorstoreId - The vectorstore id.
     * @returns {void}
     */
	set vectorstore_id(vectorstoreId){
		/* validate vectorstoreId */
		if(!vectorstoreId?.length)
			throw new Error('vectorstoreId required')
		/* cosmos */
        const { id, } = this
        this.#factory.updateItem({ id, vectorstore_id: vectorstoreId }) /* no await */
		this.#vectorstoreId = vectorstoreId /* update local */
	}
}
/**
 * The System Avatar singleton for MyLife.
 * @class
 * @extends Avatar
 */
class Q extends Avatar {
    #conversations = []
    #factory // same reference as Avatar, but wish to keep private from public interface; don't touch my factory, man!
    #hostedMembers = [] // MyLife-hosted members
    #llmServices // ref _could_ differ from Avatar, but for now, same
    #mode = 'system' // @stub - experience mode for guests
    /**
     * @constructor
     * @param {MyLifeFactory} factory - The factory on which MyLife relies for all service interactions.
     * @param {LLMServices} llmServices - The LLM services object
     */
    constructor(factory, llmServices){
        if(!factory.isMyLife)
            throw new Error('factory parameter must be an instance of MyLifeFactory')
        super(factory, llmServices)
        this.#factory = factory
        this.llmServices = llmServices
    }
    /* overloaded methods */
    /**
     * OVERLOADED: Processes and executes incoming chat request.
     * @todo - shunt registration actions to different MA functions
     * @public
     * @param {string} message - The chat message content
     * @param {Guid} itemId - The active collection-item id (optional)
     * @param {MemberSession} MemberSession - The member session object
     * @returns {Promise<Object[]>} - The response(s) to the chat request
    */
    async chat(message, itemId, MemberSession){
        if(itemId?.length)
            throw new Error('MyLife System Avatar cannot process chats with `itemId`.')
        let { Conversation, } = MemberSession
        if(!Conversation){
            Conversation = await this.conversationStart('chat', 'system-avatar')
            if(!Conversation)
                throw new Error('Unable to be create `Conversation`.')
            this.#conversations.push(Conversation)
            MemberSession.Conversation = Conversation
        }
        Conversation.originalPrompt = message
        Conversation.processStartTime = Date.now()
        if(this.isValidating) // trigger confirmation until session (or vld) ends
            message = `CONFIRM REGISTRATION PHASE: registrationId=${ this.registrationId }\n${ message }`
        if(this.isCreatingAccount)
            message = `CREATE ACCOUNT PHASE: ${ message }`
		Conversation.prompt = message
        const response = await this.chatAgentBypass(Conversation)
        return response
    }
    /**
     * OVERLOADED: MyLife must refuse to create bots.
     * @public
     * @throws {Error} - System avatar cannot create bots.
     */
    async createBot(){
        throw new Error('System avatar cannot create bots.')
    }
    /**
     * OVERLOADED: Given an itemId, obscures aspects of contents of the data record. Obscure is a vanilla function for MyLife, so does not require intervening intelligence and relies on the factory's modular LLM. In this overload, we invoke a micro-avatar for the member to handle the request on their behalf, with charge-backs going to MyLife as the sharing and api is a service.
     * @public
     * @param {string} mbr_id - The member id
     * @param {Guid} iid - The item id
     * @returns {Object} - The obscured item object
     */
    async obscure(mbr_id, iid){
        const botFactory = await this.avatarProxy(mbr_id)
        const updatedSummary = await botFactory.obscure(iid)
        return updatedSummary
    }
    /* overload rejections */
    /**
     * OVERLOADED: Q refuses to execute.
     * @public
     * @throws {Error} - MyLife avatar cannot upload files.
     */
    summarize(){
        throw new Error('MyLife avatar cannot summarize files.')
    }
    upload(){
        throw new Error('MyLife avatar cannot upload files.')
    }
    /* public methods */
    /**
     * Add a member to the hosted members list.
     * @param {string} id - The member id (mbr_id).
     * @returns {void}
     */
    async addMember(id){
        if(!this.#hostedMembers.find(member=>member.id===id)){
            const memberObject = {
                mbr_id: id,
                mbr_name: null,
            }
            const hostedMember = mAvatarDropdown(this.globals, memberObject)
            if(hostedMember){
                this.#hostedMembers.push(hostedMember)
                this.#hostedMembers.sort((a, b) => a.name.localeCompare(b.name))
            }
        }
    }
    /**
     * Returns the Member Avatar proxy for the member id.
     * @param {string} mbr_id - The member id
     * @returns {Promise<BotFactory>} - The Member Avatar proxy
     */
    async avatarProxy(mbr_id){
        const avatar = await this.#factory.avatarProxy(mbr_id)
        return avatar
    }
    async challengeAccess(memberId, passphrase){
        const avatarProxy = await this.avatarProxy(memberId)
		const challengeSuccessful = await avatarProxy.challengeAccess(passphrase)
		return challengeSuccessful
	}
	/**
	 * Set MyLife core account basics. { birthdate, passphrase, }
	 * @todo - move to mylife agent factory
	 * @param {string} birthdate - The birthdate of the member.
	 * @param {string} passphrase - The passphrase of the member.
	 * @returns {boolean} - `true` if successful
	 */
	async createAccount(birthdate, passphrase){
        if(!birthdate?.length || !passphrase?.length)
            throw new Error('birthdate _**and**_ passphrase required')
        let avatar,
            success = false
        avatar = await this.#factory.createAccount(birthdate, passphrase)
        if(Object.keys(avatar).length){
            const { mbr_id, } = avatar
            success = true
            this.addMember(mbr_id)
            console.log(`member account created: ${ mbr_id }`)
        } else
            console.log('member account creation failed')
        return {
            avatar,
            success,
        }
    }
    /**
     * Returns list of Q's hostedMembers, using this.#hostedMembers, created on-demand.
     * @todo - this.#hostedMembers should contain name data (more than just id) for dropdowns
     * @param {Guid} key - The key to handshake against provider.
     * @returns {Object[]} - List of hosted member dropdown objects { id, name, }.
     */
    async hostedMembers(key){
        if(!this.globals.isValidGuid(key) || key!==this.hosting_key)
            throw new Error('Invalid key for hosted members.')
        if(!this.#hostedMembers.length){ // on-demand creation
            console.log('hostedMembers', this.#hostedMembers)
            const hostedMembers = await this.#factory.hostedMembers()
            if(!hostedMembers.length)
                throw new Error('No hosted members found.')
            this.#hostedMembers = hostedMembers
                .map(avatar=>mAvatarDropdown(this.globals, avatar))
                .sort((a, b) => a.name.localeCompare(b.name))
        }
        return this.#hostedMembers
    }
    /* getters/setters */
    /**
     * Get the "avatar's" being, or more precisely the name of the being (affiliated object) the evatar is emulating.
     * Avatars are special case and are always avatars, so when we query them non-internally for system purposes (in which case we understand we need to go directly to factory.core.being) we display the underlying essence of the datacore; could put this in its own variable, but this seems protective _and_ gives an access point for alterations.
     * @getter
     * @returns {string} The object being the avatar is emulating.
    */
    get being(){  
        return 'MyLife'
    }
    /**
     * Get conversations. If getting a specific conversation, use .conversation(id).
     * @getter
     * @returns {array} - The conversations.
     */
    get conversations(){
        return this.#conversations
    }
}
/* module functions */
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
 * 
 * @param {Globals} globals - Globals object.
 * @param {object} avatar - Avatar object.
 */
function mAvatarDropdown(globals, avatar){
    const { mbr_id: id, mbr_name, } = avatar
    const name = globals.sysName(id) 
    return {
        id,
        name,
    }
}
/**
 * Cancels openAI run.
 * @module
 * @param {LLMServices} llm - The LLMServices instance
 * @param {string} thread_id - Thread id
 * @param {string} runId - Run id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mCancelRun(llm, thread_id, runId,){
    return await llm.beta.threads.runs.cancel(
        thread_id,
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
    cast = await Promise.all(cast.map(async castMember=>{
        const actor = new (factory.castMember)(castMember)
        const { type, } = castMember
        switch(type.toLowerCase()){
            case 'actor': // system actor
            case 'system':
                actor.bot = await factory.actorGeneric
                actor.bot_id = actor.bot.id
                break
            case 'mylife': // Q
            case 'q':
                actor.bot = await factory.actorQ
                actor.bot_id = actor.bot.id
                break
            case 'bot': // identified member-specific bot
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
        const { id: bot_id, thread_id, } = activeBot
        const content = message?.content ?? message?.message ?? message
        message = new (factory.message)({
            being: 'message',
            content,
            role: 'assistant',
            thread_id,
            type: 'system'
        })
    }
    message = mPruneMessage(bot_id, message, 'system')
    return message
}
/**
 * Takes character data and makes necessary adjustments to roles, urls, etc.
 * @todo - icon and background changes
 * @todo - bot changes... allowed?
 * @param {LLMServices} llm - OpenAI object
 * @param {Experience} experience - Experience class instance
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
            const { bot, } = castMember
            const { bot_id, id, } = bot // two properties needed for mPruneMessage
            if(!bot_id || !id){
                console.log('mEventDialog::bot id not found in cast', characterId, castMember, bot)
                throw new Error('Bot id not found in cast.')
            }
            scriptDialog.bot_id = bot_id ?? scriptAdvisorBotId
            console.log('mEventDialog::bot id found in cast', characterId, castMember.inspect(true), scriptDialog.bot_id)
            if(example?.length)
                prompt = `using example: "${example}";\n` + prompt
            if(dialogVariables.length)
                prompt = mReplaceVariables(prompt, dialogVariables, experienceVariables)
            const messages = await mCallLLM(llm, scriptDialog, prompt)
            if(!messages?.length)
                console.log('mEventDialog::no messages returned from LLM', prompt, bot_id)
            scriptDialog.addMessages(messages)
            memberDialog.addMessage(scriptDialog.mostRecentDialog) // text string
            const responseDialog = new Marked().parse(memberDialog.mostRecentDialog)
            return responseDialog
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
    scriptConsultant.bot_id = scriptAdvisorBotId
    const messages = await mCallLLM(llm, scriptConsultant, prompt)
        ?? []
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
        avatar.conversationStart('experience'),
        avatar.conversationStart('dialog')
    ]) // async construction
    experience.memberDialog = memberDialog
    experience.scriptDialog = scriptDialog
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
 * Initializes the Avatar instance with stored data
 * @param {MyLifeFactory|AgentFactory} factory - Member Avatar or Q
 * @param {LLMServices} llmServices - OpenAI object
 * @param {Q|Avatar} avatar - The avatar Instance (`this`)
 * @param {BotAgent} botAgent - BotAgent instance
 * @param {AssetAgent} assetAgent - AssetAgent instance
 * @returns {Promise<void>} - Return indicates successfully mutated avatar
 */
async function mInit(factory, llmServices, avatar, botAgent, assetAgent){
    /* initial assignments */
    const { being, mbr_id, ...avatarProperties } = factory.globals.sanitize(await factory.avatarProperties())
    Object.assign(avatar, avatarProperties)
    if(!factory.isMyLife){
        const { mbr_id, vectorstore_id, } = avatar
        avatar.nickname = avatar.nickname
            ?? avatar.names?.[0]
            ?? `${ avatar.memberFirstName ?? 'member' }'s avatar`
        if(!vectorstore_id){
            const vectorstore = await llmServices.createVectorstore(mbr_id)
            if(vectorstore?.id){
                avatar.vectorstore_id = vectorstore.id
                await assetAgent.init(avatar.vectorstore_id)
            }
        }
    }
    /* initialize default bots */
    await botAgent.init(avatar.id, avatar.vectorstore_id)
    if(factory.isMyLife)
        return
    /* evolver */
    avatar.evolver = await (new EvolutionAgent(avatar))
        .init()
    /* lived-experiences */
    avatar.experiencesLived = await factory.experiencesLived(false)
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
function mPruneConversation(conversation){
    const { bot_id, form, id, name, type, } = conversation
    return {
        bot_id,
        form,
        id,
        name,
        type,
    }
}
/**
 * Returns a frontend-ready object, pruned of cosmos database fields.
 * @param {object} document - The document object to prune.
 * @returns {object} - The pruned document object.
 */
function mPruneDocument(document){
    const {
        being,
        mbr_id,
        name,
        _attachments,
        _etag,
        _rid,
        _self,
        _ts,
        ..._document
    } = document
    return _document
}
function mPruneItem(item){
    return mPruneDocument(item)
}
/**
 * Returns frontend-ready Message object after logic mutation.
 * @module
 * @private
 * @param {Guid} activeBotId - The Active Bot id property
 * @param {string} message - The text of LLM message; can parse array of messages from openAI
 * @param {string} type - The type of message, defaults to chat
 * @param {number} processStartTime - The time the process started, defaults to function call
 * @returns {object} - The pruned message object
 */
function mPruneMessage(activeBotId, message, type='chat', processStartTime=Date.now()){
    /* parse message */
    let agent='server',
        content='',
        response_time=Date.now()-processStartTime
    const { content: messageContent, } = message
    const rSource = /【.*?\】/gs
    const rLines = /\n{2,}/g
    content = Array.isArray(messageContent)
        ? messageContent.reduce((acc, item) => {
            if (item?.type==='text' && item?.text?.value){
                acc += item.text.value + '\n'
            }
            return acc
        }, '')
        : messageContent
    content = content.replace(rLines, '\n')
        .replace(rSource, '') // This line removes OpenAI LLM "source" references
    message = new Marked().parse(content)
    const messageResponse = {
        activeBotId,
        agent,
        message,
        response_time,
        type,
    }
    return messageResponse
}
/**
 * Prune an array of Messages and return.
 * @param {Guid} bot_id - The Active Bot id property
 * @param {Object[]} messageArray - The array of messages to prune
 * @param {string} type - The type of message, defaults to chat
 * @param {number} processStartTime - The time the process started, defaults to function call
 * @returns {Object[]} - Concatenated message object
 */
function mPruneMessages(bot_id, messageArray, type='chat', processStartTime=Date.now()){
    if(!messageArray.length)
        throw new Error('No messages to prune')
    messageArray = messageArray
        .map(message=>mPruneMessage(bot_id, message, type, processStartTime))
    return messageArray
}
/**
 * Returns a narration packet for a memory reliving. Will allow for and accommodate the incorporation of helpful data _from_ the avatar member into the memory item `summary` and other metadata. The bot by default will:
 * - break memory into `scenes` (minimum of 3: 1) set scene, ask for input [determine default what] 2) develop action, dramatize, describe input mechanic 3) conclude scene, moralize - what did you learn? then share what you feel author learned
 * - perform/narrate the memory as scenes describe
 * - others are common to living, but with `reliving`, the biographer bot (only narrator allowed in .10) incorporate any user-contributed contexts or imrpovements to the memory summary that drives the living and sharing. All by itemId.
 * - if user "interrupts" then interruption content should be added to memory updateSummary; doubt I will keep work interrupt, but this too is hopefully able to merely be embedded in the biographer bot instructions.
 * Currently testing efficacy of all instructions (i.e., no callbacks, as not necessary yet) being embedded in my biog-bot, `madrigal`.
 * @param {object} item - The memory object
 * @param {string} memberInput - The member input (or simply: NEXT, SKIP, etc.)
 * @param {BotAgent} BotAgent - The Bot Agent instance
 * @param {Avatar} Avatar - Member Avatar instance
 * @returns {Promise<object>} - The reliving memory object for frontend to execute: 
 */
async function mReliveMemoryNarration(item, memberInput, BotAgent, Avatar){
    Avatar.livingMemory = await BotAgent.liveMemory(item, memberInput, Avatar)
    const { Conversation, } = Avatar.livingMemory
    const { bot_id, type, } = Conversation
    const responses = Conversation.getMessages()
        .map(message=>mPruneMessage(bot_id, message, type))
    const memory = {
        item,
        responses,
        success: true,
    }
    return memory
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
    if(!factory.globals.isValidGuid(validationId))
        throw new Error('FAILURE::validateRegistration()::Invalid validation id.')
    /* validate validationId */
    let message,
        registrationData = { id: validationId },
        success = false
    const registration = await factory.validateRegistration(validationId)
    const messages = []
    const failureMessage = `I\'m sorry, but I\'m currently unable to validate your registration id:<br />${ validationId }.<br />I\'d be happy to talk with you more about MyLife, but you may need to contact member support to resolve this issue.`
    /* determine eligibility */
    if(registration){
        const { avatarName, being, email: registrationEmail, humanName, } = registration
        const eligible = being==='registration'
            && factory.globals.isValidEmail(registrationEmail)
        if(eligible){
            const successMessage = `Hello and _thank you_ for your registration, ${ humanName }!\nI'm Q, the ai-representative for MyLife, and I'm excited to help you get started, so let's do the following:\n1. Verify your email address\n2. set up your account\n3. get you started with your first MyLife experience!\n<br />\n<br />Let me walk you through the process.<br />In the chat below, please enter the email you registered with and hit the <b>submit</b> button!`
            message = mCreateSystemMessage(activeBot, successMessage, factory)
            registrationData.avatarName = avatarName ?? humanName ?? 'My AI-Agent'
            registrationData.humanName = humanName
            success = true
        }
    }
    if(!message)
        message = mCreateSystemMessage(activeBot, failureMessage, factory)
    messages.push(message)
    return { registrationData, messages, success, }
}
/* exports */
export {
	Avatar,
	Q,
}