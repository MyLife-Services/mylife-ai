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
     * Extracts response from LLM response object.
     * @param {Object[]} responses - Array of LLM response objects
     * @param {String} provider - LLM provider
     * @returns {Array} - Array of extracted string responses
     */
    extractResponses(llmResponses, provider){
        if(!llmResponses?.length)
            return []
        const responses = []
        llmResponses.forEach(response=>{
                if(typeof response==='string' && response.length)
                    responses.push(response)
                const { assistant_id: llm_id, content, created_at, id, run_id, thread_id, } = response
                if(!!content?.length)
                    content.forEach(content=>{
                        if(!!content?.text?.value?.length)
                            responses.push(content.text.value)
                    })

            })
        return responses
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
     * @todo - confirm that reason for **factory** is to run functions as responses from LLM; #botAgent if possible, Avatar if not
     * @todo - cancel run on: 400 Can't add messages to `thread_...` while a run `run_...` is active.
     * @param {string} thread_id - Thread id
     * @param {string} llm_id - GPT-Assistant/Bot id
     * @param {string} prompt - Member input
     * @param {AgentFactory} factory - Avatar Factory object to process request
     * @param {Avatar} avatar - Avatar object
     * @returns {Promise<Object[]>} - Array of openai `message` objects
     */
    async getLLMResponse(thread_id, llm_id, prompt, factory, avatar){
        if(!thread_id?.length)
            thread_id = ( await mThread(this.openai) ).id
        try{
            await mAssignRequestToThread(this.openai, thread_id, prompt)
        } catch(error) {
            console.log('LLMServices::getLLMResponse()::error', error.message)
            try{
                if(error.status==400){
                    const cancelRun = await mRunCancel(this.openai, thread_id, llm_id)
                    if(!!cancelRun)
                        await mAssignRequestToThread(this.openai, thread_id, prompt)
                    else {
                        console.log('LLMServices::getLLMResponse()::cancelRun::unable to cancel run', cancelRun)
                        return []
                    }
                }
            } catch(error) {
                console.log('LLMServices::getLLMResponse()::error re-running', error.message, error.status)
                return []
            }
        }
        const run = await mRunTrigger(this.openai, llm_id, thread_id, factory, avatar)
        const { error, id: run_id, success, } = run
        if(!success){
            if(avatar.backupResponse){
                avatar.backupResponse.action = 'endMemory'
                avatar.backupResponse.error = error
                avatar.backupResponse.role = 'avatar'
                avatar.backupResponse.run_id = run_id
            }
            return []
        }
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
    } catch(err) {
        return false
    }
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
                const functionRunStatus = functionRun?.status
                    ?? functionRun
                    ?? false
                if(functionRunStatus){
                    clearInterval(checkInterval)
                    resolve(functionRun)
                }
            } catch (error){
                try {
                    await mRunCancel(llmServices, run.thread_id, run.id)
                } catch (_error){
                    console.log('mRunFinish()::cancelRun::error', _error)
                }
                clearInterval(checkInterval)
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
                            item,
                            success = false
                        if(typeof toolArguments==='string')
                            toolArguments = await JSON.parse(toolArguments)
                                ?? {}
                        toolArguments.thread_id = thread_id // deprecate?
                        const { itemId, } = toolArguments
                        switch(name.toLowerCase()){
                            case 'changetitle':
                            case 'change_title':
                            case 'change title':
                                const { title: newTitle, } = toolArguments
                                console.log('mRunFunctions()::changeTitle start', newTitle, itemId)
                                if(!itemId?.length || !newTitle?.length){
                                    action = 'apologize for lack of clarity - member should click on the collection item (like a memory, story, etc) to identify it as active'
                                    confirmation.output = JSON.stringify({ action, success, })
                                    return confirmation
                                }
                                avatar.actionCallback = 'changeTitle'
                                avatar.backupResponse = {
                                    message: `I encountered an unexpected error while changing our title to: ${ newTitle }. Please try again.`,
                                    type: 'system',
                                }
                                avatar.frontendInstruction = {
                                    command: 'updateItemTitle',
                                    itemId,
                                    title: newTitle,
                                }
                                throw new Error('changeTitle intentionally aborted')
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
                            case 'endreliving':
                            case 'end_reliving':
                            case 'end reliving':
                                avatar.actionCallback = 'endMemory'
                                throw new Error('endReliving intentionally aborted')
                            case 'entrysummary': // deprecate
                            case 'entry_summary':
                            case 'entry summary':
                            case 'itemsummary': // itemSummary in Globals
                            case 'item_summary':
                            case 'item summary':
                            case 'story':
                            case 'storysummary': // deprecate
                            case 'story-summary':
                            case 'story_summary':
                            case 'story summary':
                                console.log(`mRunFunctions()::${ name }`, toolArguments?.title)
                                const createSummaryResponse = await avatar.item(toolArguments, 'POST')
                                success = createSummaryResponse.success
                                action = success
                                    ? `item creation was successful; save for **internal AI reference** this itemId: ${ createSummaryResponse.item.id }`
                                    : `error creating summary for item given argument title: ${ toolArguments?.title } - DO NOT TRY AGAIN until member asks for it`
                                confirmation.output = JSON.stringify({
                                    action,
                                    success,
                                })
                                console.log(`mRunFunctions()::${ name }::success`, success, createSummaryResponse?.item?.id)
                                return confirmation    
                            case 'getsummary':
                            case 'get_summary':
                            case 'get summary':
                                let { item: getSummaryItem, success: getSummarySuccess, } = await avatar.item({ id: itemId, })
                                success = getSummarySuccess
                                action = success
                                    ? 'Summary content found in payload @ `summary`'
                                    : `No summary for item ${ itemId }, use conversation content`
                                confirmation.output = JSON.stringify({ action, success, summary: getSummaryItem?.summary, })
                                console.log('mRunFunctions()::getSummary', success, getSummaryItem?.summary?.substring(0, 32))
                                return confirmation
                            case 'hijackattempt':
                            case 'hijack_attempt':
                            case 'hijack-attempt':
                            case 'hijack attempt':
                                action = 'attempt noted in system and user ejected; greet per normal as first time new user'
                                success = true
                                confirmation.output = JSON.stringify({ action, success, })
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
                                }
                                confirmation.output = JSON.stringify({ action, success, })
                                return confirmation
                            case 'updatesummary':
                            case 'update_summary':
                            case 'update summary':
                                const { summary: newSummary, } = toolArguments
                                avatar.backupResponse = {
                                    message: `I encountered an unexpected error while updating item with id: "${ itemId }". Please try again.`,
                                    type: 'system',
                                }
                                if(!itemId?.length || !newSummary?.length){
                                    action = 'if member-driven, they should click on the appropriate collection item (like a memory, story, etc) to identify it as active'
                                    confirmation.output = JSON.stringify({ action, success, })
                                    return confirmation
                                }
                                console.log('mRunFunctions()::updatesummary::begin', itemId)
                                const updateData = {
                                    id: itemId,
                                    summary: newSummary,
                                }
                                let { instruction: updateItemInstruction, responses: updateItemResponses, success: updateItemSuccess, } = await avatar.item(updateData, 'PUT')
                                success = updateItemSuccess
                                if(avatar.livingMemory?.item?.id===itemId){
                                    delete avatar.actionCallback
                                    delete avatar.backupResponse
                                    delete avatar.frontendInstruction
                                    console.log('mRunFunctions()::updatesummary::livingMemory', success)
                                    console.trace('Call stack trace')
                                    confirmation.output = JSON.stringify({ success, })
                                    return confirmation
                                }
                                avatar.actionCallback = 'updateItem'
                                avatar.backupResponse = updateItemResponses?.[0]
                                avatar.frontendInstruction = updateItemInstruction
                                throw new Error('updateSummary intentionally aborted')
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
    } catch(error){
        if(error.status!==400)
            throw error
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
 * @returns {object} - Run object if run completed, false/voids otherwise
 */
async function mRunStatus(openai, run, factory, avatar){
    run = await openai.beta.threads.runs
        .retrieve(
            run.thread_id,
            run.id,
        )
    switch(run.status){
        case 'requires_action':
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
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunTrigger(openai, llm_id, threadId, factory, avatar){
    const run = await mRunStart(openai, llm_id, threadId)
    if(!run)
        throw new Error('Run failed to start')
    const finishRun = await mRunFinish(openai, run, factory, avatar)
        .then(_run=>{
            _run.success = true
            return _run
        })
        .catch(err=>{
            run.error = err
            run.success = false
            return run
        })
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