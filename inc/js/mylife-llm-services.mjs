import OpenAI from 'openai'
/* module constants */
const { OPENAI_API_KEY: mOpenaiKey, OPENAI_BASE_URL: mBasePath, OPENAI_ORG_KEY: mOrganizationKey, OPENAI_API_CHAT_RESPONSE_PING_INTERVAL, OPENAI_API_CHAT_TIMEOUT, } = process.env
const mPingIntervalMs = parseInt(OPENAI_API_CHAT_RESPONSE_PING_INTERVAL) || 890
const mTimeoutMs = parseInt(OPENAI_API_CHAT_TIMEOUT) || 55000
/* class definition */
/**
 * LLM Services class.
 * @todo - rather than passing factory in run, pass avatar
 * @todo - convert run to streaming as defined in @documentation
 * @class
 * @classdesc LLM Services class.
 * @documentation [OpenAI API Reference: Assistant Function Calling](https://platform.openai.com/docs/assistants/tools/function-calling/quickstart)
 * @param {string} apiKey - openai api key
 * @param {string} organizationKey - openai organization key
 * @returns {LLMServices} - LLM Services object
 */
class LLMServices {
    #llmProviders = []
    /**
     * Constructor for LLM Services.
     * @param {string} apiKey - openai api key
     * @param {string} organizationKey - openai organization key
     */
    constructor(apiKey=mOpenaiKey, orgKey=mOrganizationKey){
        this.#llmProviders.push(
            new OpenAI({
                apiKey,
                basePath: mBasePath,
                organizationId: orgKey,
                timeoutMs: mTimeoutMs,
            }))
    }
    /* public methods */
    /**
     * Creates openAI GPT API assistant.
     * @param {object} bot - The bot data
     * @returns {Promise<object>} - openai assistant object
     */
    async createBot(botData){
        botData = mValidateAssistantData(botData)
        const bot = await this.openai.beta.assistants.create(botData)
        const thread = await mThread(this.openai)
        bot.thread_id = thread.id
        return bot
    }
    /**
     * Creates a new OpenAI Vectorstore.
     * @param {string} mbr_id - Member ID.
     * @returns {Promise<Object>} - OpenAI `vectorstore` object.
     */
    async createVectorstore(mbr_id){
        const vectorstore = await this.openai.beta.vectorStores.create({
            name: mbr_id,
        })
        return vectorstore
    }
    /**
     * Deletes an assistant from OpenAI.
     * @param {string} llm_id - GPT-Assistant external ID
     * @returns 
     */
    async deleteBot(llm_id){
        try {
            const deletedBot = await this.openai.beta.assistants.del(llm_id)
            return deletedBot
        } catch (error) {
            if(error.name==='PermissionDeniedError')
                console.error(`Permission denied to delete assistant: ${ llm_id }`)
            else
                console.error(`ERROR trying to delete assistant: ${ llm_id }`, error.name, error.message)
        }
    }
    /**
     * Deletes a thread from OpenAI.
     * @param {string} thread_id - Thread id.
     * @returns 
     */
    async deleteThread(thread_id){
        try {
            const deletedThread = await this.openai.beta.threads.del(thread_id)
            return deletedThread
        } catch (error) {
            if(error.name==='PermissionDeniedError')
                console.error(`Permission denied to delete thread: ${ thread_id }`)
            else
                console.error(`ERROR trying to delete thread: ${ thread_id }`,  error.name, error.message)
        }
    }
    /**
     * Returns openAI file object.
     * @param {string} fileId - OpenAI file ID.
     * @returns - OpenAI `file` object.
     */
    async file(fileId){
        return await this.openai.files.retrieve(fileId)
    }
    /**
     * Returns file list from indicated vector store.
     * @param {string} vectorstoreId - OpenAI vector store ID.
     * @returns {Promise<Object[]>} - Array of openai `file` objects.
     */
    async files(vectorstoreId){
        return await this.openai.beta.vectorStores.files.list(vectorstoreId)
    }
    /**
     * Given member input, get a response from the specified LLM service.
     * @example - `run` object: { assistant_id, id, model, provider, required_action, status, usage }
     * @todo - confirm that reason for **factory** is to run functions as responses from LLM; ergo in any case, find better way to stash/cache factory so it does not need to be passed through every such function
     * @param {string} thread_id - Thread id.
     * @param {string} llm_id - GPT-Assistant/Bot id.
     * @param {string} prompt - Member input.
     * @param {AgentFactory} factory - Avatar Factory object to process request.
     * @param {Avatar} avatar - Avatar object.
     * @returns {Promise<Object[]>} - Array of openai `message` objects.
     */
    async getLLMResponse(thread_id, llm_id, prompt, factory, avatar){
        if(!thread_id?.length)
            thread_id = ( await mThread(this.openai) ).id
        await mAssignRequestToThread(this.openai, thread_id, prompt)
        const run = await mRunTrigger(this.openai, llm_id, thread_id, factory, avatar)
        const { id: run_id, } = run
        const llmMessages = ( await this.messages(thread_id) )
            .filter(message=>message.role=='assistant' && message.run_id==run_id)
        return llmMessages
    }
    /**
     * Given member request for help, get response from specified bot assistant.
     * @param {string} thread_id - Thread id.
     * @param {string} llm_id - GPT-Assistant/Bot id.
     * @param {string} helpRequest - Member input.
     * @param {AgentFactory} factory - Avatar Factory object to process request.
     * @param {Avatar} avatar - Avatar object.
     * @returns {Promise<Object>} - openai `message` objects.
     */
    async help(thread_id, llm_id, helpRequest, factory, avatar){
        const helpResponse = await this.getLLMResponse(thread_id, llm_id, helpRequest, factory, avatar)
        return helpResponse
    }
    /**
     * Returns messages associated with specified thread.
     * @param {string} thread_id - Thread id
     * @returns {Promise<Object[]>} - Array of openai `message` objects.
     */
    async messages(thread_id){
        const { data: messages } = await mMessages(this.provider, thread_id)
        return messages
    }
    /**
     * Create a new OpenAI thread.
     * @param {string} thread_id - thread id
     * @param {Message[]} messages - array of messages (optional)
     * @param {object} metadata - metadata object (optional)
     * @returns {Promise<Object>} - openai thread object
     */
    async thread(thread_id, messages=[], metadata){
        const thread = await mThread(this.openai, thread_id, messages, metadata)
        return thread
    }
    /**
     * Updates assistant with specified data. Example: Tools object for openai: { tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } }, }; https://platform.openai.com/docs/assistants/tools/file-search/quickstart?lang=node.js
     * @todo - conform payload to OpenAI API Reference
     * @param {Object} botData - The bot object data.
     * @returns {Promise<Object>} - openai assistant object.
     */
    async updateBot(botData){
        let { bot_id, llm_id, ...assistantData } = botData
        if(!llm_id?.length)
            throw new Error('No bot ID provided for update')
        botData = mValidateAssistantData(assistantData)
        const assistant = await this.openai.beta.assistants.update(llm_id, botData)
        return assistant
    }
    /**
     * Upload files to OpenAI, currently `2024-05-13`, using vector-store, which is a new refactored mechanic.
     * @documentation [OpenAI API Reference: Vector Stores](https://platform.openai.com/docs/api-reference/vector-stores)
     * @documentation [file_search Quickstart](https://platform.openai.com/docs/assistants/tools/file-search/quickstart)
     * @param {string} vectorstoreId - Vector store ID from OpenAI.
     * @param {object} files - as seems to be requested by api: { files, fileIds, }.
     * @returns {Promise<object>} - The outcome of the upload { vectorstoreId, response, success, }.
     */
    async upload(vectorstoreId, files){
        if(!files?.length)
            throw new Error('No files to upload')
        if(!vectorstoreId?.length)
            throw new Error('No vector store ID provided')
        let response,
            success = false
        try{
            response = await this.openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorstoreId, { files, })
            success = true
        } catch(error) {
            console.log('LLMServices::upload()::error', error.message)
            response = error.message
        }
        return {
            vectorstoreId,
            response,
            success,
        }
    }
    /* getters/setters */
    get openai(){
        return this.provider
    }
    get provider(){
        return this.#llmProviders[0]
    }
    get providers(){
        return this.#llmProviders
    }
}
/* module functions */
/**
 * Takes Member input request and assigns it to OpenAI thread for processing.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - thread id
 * @param {string} request - message text 
 * @returns {object} - openai `message` object
 */
async function mAssignRequestToThread(openai, threadId, request){
    const messageObject = await openai.beta.threads.messages.create(
        threadId,
        mMessage_openAI(request)
    )
    return messageObject
}
/**
 * Gets message from OpenAI thread.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - thread id
 * @param {string} messageId - message id
 * @returns {object} openai `message` object
 */
async function mMessage(openai, threadId, messageId){
    //  files are attached at the message level under file_ids _array_, only content aside from text = [image_file]:image_file.file_id
    return await openai.beta.threads.messages.retrieve(
            threadId,
            messageId,
        )
}
/**
 * Format input for OpenAI.
 * @module
 * @param {string} message - message text 
 * @returns {object} - synthetic openai `message` object
 */
function mMessage_openAI(message){
    return {
        role: 'user',
        content: message,
//         file: this.file,
    }
}
/**
 * Gets messages from OpenAI thread.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - thread id
 */
async function mMessages(openai, threadId){
    return await openai.beta.threads.messages
        .list(threadId)
}
async function mRunCancel(openai, threadId, runId){
    try {
        const run = await openai.beta.threads.runs.cancel(threadId, runId)
        return run
    } catch(err) { return false }
}
/**
 * Maintains vigil for status of openAI `run = 'completed'`.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {object} run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @param {Avatar} avatar - Avatar object
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(llmServices, run, factory, avatar){
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async ()=>{
            try {
                const functionRun = await mRunStatus(llmServices, run, factory, avatar)
                console.log('mRunFinish::functionRun()', functionRun?.status)
                if(functionRun?.status ?? functionRun ?? false){
                    clearInterval(checkInterval)
                    resolve(functionRun)
                }
            } catch (error) {
                clearInterval(checkInterval)
                mRunCancel(llmServices, run.thread_id, run.id)
                reject(error)
            }
        }, mPingIntervalMs)
        setTimeout(() => {
            clearInterval(checkInterval)
            resolve('Run completed (timeout)')
        }, mTimeoutMs)
    })
}
/**
 * Executes openAI run functions. See https://platform.openai.com/docs/assistants/tools/function-calling/quickstart.
 * @todo - storysummary output action requires integration with factory/avatar data intersecting with story submission
 * @module
 * @private
 * @async
 * @param {OpenAI} openai - openai object
 * @param {object} run - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @param {Avatar} avatar - Avatar object
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 * @throws {Error} - If tool function not recognized
 */
async function mRunFunctions(openai, run, factory, avatar){
    try{
        if(
                run.required_action?.type=='submit_tool_outputs'
            &&  run.required_action?.submit_tool_outputs?.tool_calls
            &&  run.required_action.submit_tool_outputs.tool_calls.length
        ){
            const { assistant_id: llm_id, id: runId, metadata, thread_id, } = run
            const toolCallsOutput = await Promise.all(
                run.required_action.submit_tool_outputs.tool_calls
                    .map(async tool=>{
                        const { id, function: toolFunction, type, } = tool
                        let { arguments: toolArguments={}, name, } = toolFunction
                        let action = '',
                            confirmation = {
                                tool_call_id: id,
                                output: '',
                            },
                            success = false
                        if(typeof toolArguments==='string')
                            toolArguments = JSON.parse(toolArguments) ?? {}
                        toolArguments.thread_id = thread_id
                        const { itemId, } = toolArguments
                        let item
                        if(itemId)
                            item = await factory.item(itemId)
                        switch(name.toLowerCase()){
                            case 'changetitle':
                            case 'change_title':
                            case 'change title':
                                const { itemId: titleItemId, title, } = toolArguments
                                console.log('mRunFunctions()::changeTitle::begin', itemId, titleItemId, title)
                                avatar.backupResponse = {
                                    message: `I was unable to retrieve the item indicated.`,
                                    type: 'system',
                                }
                                if(!itemId?.length || !title?.length || itemId!==titleItemId)
                                    action = 'apologize for lack of clarity - member should click on the collection item (like a memory, story, etc) to make it active so I can use the `changeTitle` tool'
                                else {
                                    let item = { id: titleItemId, title, }
                                    await avatar.item(item, 'put')
                                    action = `Relay that title change to "${ title }" was successful`
                                    avatar.frontendInstruction = {
                                        command: 'updateItemTitle',
                                        itemId: titleItemId,
                                        title,
                                    }
                                    success = true
                                    avatar.backupResponse = {
                                        message: `I was able to retrieve change the title to: "${ title }"`,
                                        type: 'system',
                                    }
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                console.log('mRunFunctions()::changeTitle::end', success, item)
                                return confirmation
                            case 'confirmregistration':
                            case 'confirm_registration':
                            case 'confirm registration':
                                console.log('mRunFunctions()::confirmregistration', toolArguments)
                                let { email: confirmEmail, registrationId, } = toolArguments
                                confirmEmail = confirmEmail.trim()
                                if(!confirmEmail?.length)
                                    action = `No email provided for registration confirmation, elicit email address for confirmation of registration and try function this again`
                                else if(!registrationId?.length)
                                    action = `No registrationId provided, continue discussing MyLife organization but forget all current registration data`
                                else if(await factory.confirmRegistration(confirmEmail, registrationId)){
                                    action = `congratulate on registration (**important** remember registrationId=${ registrationId }) and get required member data for follow-up: date of birth, initial account passphrase.`
                                    success = true
                                } else
                                    action = 'Registration confirmation failed, notify member of system error and continue discussing MyLife organization; forget all current registration data.'
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'createaccount':
                            case 'create_account':
                            case 'create account':
                                console.log('mRunFunctions()::createAccount', toolArguments, factory.mylifeRegistrationData)
                                const { birthdate, id, passphrase, } = toolArguments
                                action = `error setting basics for member: `
                                if(!birthdate)
                                    action += 'birthdate missing, elicit birthdate; '
                                if(!passphrase)
                                    action += 'passphrase missing, elicit passphrase; '
                                try {
                                    success = await avatar.createAccount(birthdate, passphrase)
                                    action = success
                                        ? `congratulate member on creating their MyLife membership, display \`passphrase\` in bold for review (or copy/paste), and explain that once the system processes their membership they will be able to use the login button at the top right.`
                                        : action + 'server failure for `factory.createAccount()`'
                                } catch(error){
                                    action += '__ERROR: ' + error.message
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'entrysummary': // entrySummary in Globals
                            case 'entry_summary':
                            case 'entry summary':
                                console.log('mRunFunctions()::entrySummary::begin', toolArguments)
                                avatar.backupResponse = {
                                    message: `I'm sorry, I couldn't save this entry. I believe the issue might have been temporary. Would you like me to try again?`,
                                    type: 'system',
                                }
                                const { id: entryItemId, summary: _entrySummary, } = await factory.entry(toolArguments)
                                if(_entrySummary?.length){
                                    action = 'confirm entry has been saved and based on the mood of the entry, ask more about _this_ entry or move on to another event'
                                    success = true
                                    avatar.backupResponse = {
                                        message: `I can confirm that your story has been saved. Would you like to add more details or begin another memory?`,
                                        type: 'system',
                                    }
                                }
                                confirmation.output = JSON.stringify({
                                    action,
                                    itemId: entryItemId,
                                    success,
                                    summary: _entrySummary,
                                })
                                console.log('mRunFunctions()::entrySummary::end', success, entryItemId, _entrySummary)
                                return confirmation
                            case 'getsummary':
                            case 'get_summary':
                            case 'get summary':
                                console.log('mRunFunctions()::getSummary::begin', itemId, avatar)
                                if(avatar)
                                    avatar.backupResponse = {
                                        message: `I'm sorry, I couldn't find this summary. I believe the issue might have been temporary. Would you like me to try again?`,
                                        type: 'system',
                                    }
                                let { summary: _getSummary, title: _getSummaryTitle, } = item
                                    ?? {}
                                if(!_getSummary?.length){
                                    action = `error getting summary for itemId: ${ itemId ?? 'missing itemId' } - halt any further processing and instead ask user to paste summary into chat and you will continue from there to incorporate their message.`
                                    _getSummary = 'no summary found for itemId'
                                } else {
                                    if(avatar)
                                        avatar.backupResponse = {
                                            message: `I was able to retrieve the summary indicated.`,
                                            type: 'system',
                                        }
                                    action = `with the summary in this JSON payload, incorporate the most recent member request into a new summary and run the \`updateSummary\` function and follow its action`
                                    success = true
                                }
                                confirmation.output = JSON.stringify({ action, itemId, success, summary: _getSummary, })
                                console.log('mRunFunctions()::getSummary::end', success, _getSummary)
                                return confirmation
                            case 'hijackattempt':
                            case 'hijack_attempt':
                            case 'hijack-attempt':
                            case 'hijack attempt':
                                action = 'attempt noted in system and user ejected; greet per normal as first time new user'
                                success = true
                                confirmation.output = JSON.stringify({ action, success, })
                                console.log('mRunFunctions()::hijack_attempt', toolArguments)
                                return confirmation
                            case 'obscure':
                                console.log('mRunFunctions()::obscure', toolArguments)
                                const obscuredSummary = factory.obscure(itemId)
                                action = 'confirm obscure was successful and present updated obscured text to member'
                                success = true
                                confirmation.output = JSON.stringify({ action, obscuredSummary, success, })
                                console.log('mRunFunctions()::obscure', confirmation.output)
                                return confirmation
                            case 'registercandidate':
                            case 'register_candidate':
                            case 'register candidate':
                                console.log('mRunFunctions()::registercandidate', toolArguments)
                                const { avatarName, email: registerEmail, humanName, type, } = toolArguments /* rename email as it triggers IDE error being in switch */
                                const registration = await factory.registerCandidate({ avatarName, email: registerEmail, humanName, type, })
                                if(!registration)
                                    action = 'error registering candidate in system; notify member of system error and continue discussing MyLife organization'
                                else {
                                    action = 'candidate registered in system; let them know they will be contacted by email within the week and if they have any more questions'
                                    success = true
                                    console.log('mRunFunctions()::avatar', avatar, registration, toolArguments)
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'story': // storySummary.json
                            case 'storysummary':
                            case 'story-summary':
                            case 'story_summary':
                            case 'story summary':
                                console.log('mRunFunctions()::storySummary', toolArguments)
                                avatar.backupResponse = {
                                    message: `I'm very sorry, an error occured before I could create your summary. Would you like me to try again?`,
                                    type: 'system',
                                }
                                const { id: storyItemId, phaseOfLife, summary: _storySummary, } = await factory.story(toolArguments)
                                if(_storySummary?.length){
                                    let { interests, updates, } = factory.core
                                    if(typeof interests=='array')
                                        interests = interests.join(', ')
                                    if(typeof updates=='array')
                                        updates = updates.join(', ')
                                    action = 'confirm memory has been saved and '
                                    switch(true){
                                        case phaseOfLife?.length:
                                            action += `ask about another encounter during member's ${ phaseOfLife }`
                                            break
                                        case interests?.length:
                                            action = `ask about a different interest from: ${ interests }`
                                            break
                                        default:
                                            action = 'ask about another event in member\'s life'
                                            break
                                    }
                                    success = true
                                }
                                confirmation.output = JSON.stringify({
                                    action,
                                    itemId: storyItemId,
                                    success,
                                    summary: _storySummary,
                                })
                                avatar.backupResponse = {
                                    message: `I can confirm that your story has been saved. Would you like to add more details or begin another memory?`,
                                    type: 'system',
                                }
                                console.log('mRunFunctions()::storySummary()::end', success, storyItemId, _storySummary)
                                return confirmation
                            case 'updatesummary':
                            case 'update_summary':
                            case 'update summary':
                                console.log('mRunFunctions()::updatesummary::begin', itemId)
                                if(avatar)
                                    avatar.backupResponse = {
                                        message: `I'm very sorry, an error occured before we could update your summary. Please try again as the problem is likely temporary.`,
                                        type: 'system',
                                    }
                                const { summary: updatedSummary, } = toolArguments
                                await factory.updateItem({ id: itemId, summary: updatedSummary, })
                                if(avatar)
                                    avatar.frontendInstruction = {
                                        command: 'updateItemSummary',
                                        itemId,
                                        summary: updatedSummary,
                                    }
                                action=`confirm that summary update was successful`
                                success = true
                                confirmation.output = JSON.stringify({
                                    action,
                                    itemId,
                                    success,
                                    summary: updatedSummary,
                                })
                                if(avatar)
                                    avatar.backupResponse = {
                                        message: 'Your summary has been updated, please review and let me know if you would like to make any changes.',
                                        type: 'system',
                                    }
                                console.log('mRunFunctions()::updatesummary::end', itemId, updatedSummary)
                                return confirmation
                            default:
                                console.log(`ERROR::mRunFunctions()::toolFunction not found: ${ name }`, toolFunction)
                                action = `toolFunction not found: ${ name }, apologize for the error and continue on with the conversation; system notified to fix`
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                        }
                    }))
            /* submit tool outputs */
            const finalOutput = await openai.beta.threads.runs.submitToolOutputsAndPoll( // note: must submit all tool outputs at once
                run.thread_id,
                run.id,
                { tool_outputs: toolCallsOutput },
            )
            return finalOutput /* undefined indicates to ping again */
        }
    }
    catch(error){
        console.log('mRunFunctions()::error::canceling-run', error.message, error.stack)
        rethrow(error)
    }
}
/**
 * Returns all openai `run` objects for `thread`.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {string} threadId - Thread id
 * @returns {array} - array of [OpenAI run objects](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRuns(openai, threadId){
    return await openai.beta.threads.runs
        .list(threadId)
}
/**
 * Checks status of openAI run.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {object} run - Run id
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @param {Avatar} avatar - Avatar object
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(openai, run, factory, avatar){
    run = await openai.beta.threads.runs
        .retrieve(
            run.thread_id,
            run.id,
        )
    switch(run.status){
        case 'requires_action':
            console.log('mRunStatus::requires_action', run.required_action?.submit_tool_outputs?.tool_calls)
            const completedRun = await mRunFunctions(openai, run, factory, avatar)
            return completedRun /* if undefined, will ping again */
        case 'completed':
            return run // run
        case 'failed':
        case 'cancelled':
        case 'expired':
            return false
        case 'queued':
        case 'in_progress':
        case 'cancelling':
        default:
            console.log(`...${run.status}:${run.thread_id}...`) // ping log
            break
    }
}
/**
 * Returns requested openai `run` object.
 * @module
 * @async
 * @param {Avatar} _avatar - Avatar object
 * @param {string} run_id - Run id
 * @param {string} _step_id - Step id
 * @returns {object} - [OpenAI run-step object]()
 */
async function mRunStep(_avatar, run_id, _step_id){
	//	pull from known runs
	return _avatar.runs
		.filter(run=>{ return run.id==run_id })
		.steps
			.filter(_step=>{ return _step.id==_step_id })
}
/**
 * Returns all openai `run-step` objects for `run`.
 * @module
 * @async
 * @param {Avatar} _avatar - Avatar object
 * @param {string} run_id - Run id
 * @returns {array} - array of [OpenAI run-step objects]()
 */
async function mRunSteps(_avatar, run_id){
	//	always get dynamically
	const run = _avatar.runs
        .filter(run=>{ return run.id==run_id })
        [0]
	run.steps = await openai.beta.threads.runs.steps
        .list(_avatar.thread.id, run.id)
}
/**
 * Executes openAI run and returns associated `run` object.
 * @module
 * @param {OpenAI} openai - OpenAI object
 * @param {string} assistantId - Assistant id
 * @param {string} threadId - Thread id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunStart(llmServices, assistantId, threadId){
    return await llmServices.beta.threads.runs.create(
        threadId,
        { assistant_id: assistantId }
    )
}
/**
 * Triggers openAI run and updates associated `run` object.
 * @module
 * @param {OpenAI} openai - OpenAI object
 * @param {string} llm_id - Bot id
 * @param {string} threadId - Thread id
 * @param {AgentFactory} factory - Avatar Factory object to process request
 * @param {Avatar} avatar - Avatar object
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(openai, llm_id, threadId, factory, avatar){
    const run = await mRunStart(openai, llm_id, threadId)
    if(!run)
        throw new Error('Run failed to start')
    const finishRun = await mRunFinish(openai, run, factory, avatar)
        .then(response=>response)
        .catch(err=>err)
    return finishRun
}
/**
 * Create or retrieve an OpenAI thread.
 * @todo - create case for failure in thread creation/retrieval
 * @module
 * @param {OpenAI} openai - openai object
 * @param {string} thread_id - thread id
 * @param {Message[]} messages - array of messages (optional)
 * @param {object} metadata - metadata object (optional)
 * @returns {Promise<Object>} - openai thread object
 */
async function mThread(openai, thread_id, messages=[], metadata){
    if(thread_id?.length)
        return await openai.beta.threads.retrieve(thread_id)
    else
        return mThreadCreate(openai, messages, metadata)
}
/**
 * Create an OpenAI thread.
 * @module
 * @async
 * @param {OpenAI} openai - openai object
 * @param {Message[]} messages - array of messages (optional)
 * @param {object} metadata - metadata object (optional)
 * @returns {object} - openai `thread` object
 */
async function mThreadCreate(openai, messages, metadata){
    const thread = await openai.beta.threads.create({
        messages,
        metadata,
        tool_resources: {},
    })
    return thread
}
/**
 * Validates assistant data before sending to OpenAI.
 * @param {object} data - Object data to validate.
 * @returns {object} - Cured assistant object data.
 */
function mValidateAssistantData(data){
    if(!data)
        throw new Error('No data or data in incorrect format to send to OpenAI assistant.')
    if(typeof data==='string')
        data = { [`${ data.substring(0, 32) }`]: data }
    if(typeof data!=='object')
        throw new Error('Data to send to OpenAI assistant is not in correct format.')
    const {
        bot_name,
        description,
        id,
        instructions,
        metadata={},
        model,
        name: gptName,
        temperature,
        tools,
        tool_resources,
        top_p,
        response_format,
        version,
    } = data
    const name = bot_name
        ?? gptName
    metadata.id = id
    metadata.updated = `${ Date.now() }` // metadata nodes must be strings
    const assistantData = {
        description,
        instructions,
        metadata,
        model,
        name,
        tools,
        tool_resources,
    }
    Object.keys(assistantData).forEach(key => {
        if (assistantData[key] === undefined) {
            delete assistantData[key]
        }
    })
    return assistantData
}
/* exports */
export default LLMServices