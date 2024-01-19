import { _ } from 'ajv'
import { Marked } from 'marked'
/* modular constants */
/* modular "public" functions */
/**
 * Initializes openAI assistant and returns associated `assistant` object.
 * @modular
 * @public
 * @param {OpenAI} _openai - OpenAI object
 * @param {object} _botData - bot creation instructions.
 * @returns {object} - [OpenAI assistant object](https://platform.openai.com/docs/api-reference/assistants/object)
 */
async function mAI_openai(_openai, _botData){
    const _assistantData = {
        description: _botData.description,
        model: _botData.model,
        name: _botData.bot_name??_botData.name, // take friendly name before Cosmos
        instructions: _botData.instructions,
    }
    return await _openai.beta.assistants.create(_assistantData)
}
/**
 * Assigns evolver listeners.
 * @modular
 * @param {EvolutionAssistant} _evolver - Evolver object
 * @param {Avatar} _avatar - Avatar object
 * @returns {void}
 */
function mAssignEvolverListeners(_evolver, _avatar){
    /* assign evolver listeners */
    _evolver.on(
        'on-contribution-new',
        _contribution=>{
            _contribution.emit('on-contribution-new', _contribution)
        }
    )
    _evolver.on(
        'avatar-change-category',
        (_current, _proposed)=>{
            _avatar.category = _proposed
            console.log('avatar-change-category', _avatar.category.category)
        }
    )
    _evolver.on(
        'on-contribution-submitted',
        _contribution=>{
            // send to gpt for summary
            const _responses = _contribution.responses.join('\n')
            // @todo: wrong factory?
            const _summary = _avatar.factory.openai.completions.create({
                model: 'gpt-3.5-turbo-instruct',
                prompt: 'summarize answers in 512 chars or less, if unsummarizable, return "NONE": ' + _responses,
                temperature: 1,
                max_tokens: 700,
                frequency_penalty: 0.87,
                presence_penalty: 0.54,
            })
            // evaluate summary
            console.log('on-contribution-submitted', _summary)
            abort
            //  if summary is good, submit to cosmos
        }
    )
}
async function mBot(_avatar, _bot){
    /* validation */
    if(!_bot?.mbr_id?.length){ _bot.mbr_id = _avatar.mbr_id }
    else if(_bot.mbr_id!==_avatar.mbr_id){ throw new Error('Bot mbr_id cannot be changed') }
    if(!_bot?.type?.length){ throw new Error('Bot type required') }
    /* set required _bot super-properties */
    if(!_bot?.parent_id?.length){ _bot.parent_id = _avatar.id } // @todo: decide if preferred mechanic
    if(!_bot?.object_id?.length){ _bot.object_id = _avatar.id }
    if(!_bot.id){ _bot.id = _avatar.factory.newGuid }
    const _botSlot = _avatar.bots.findIndex(bot => bot.id === _bot.id)
    if(_botSlot!==-1){ // update
        const _existingBot = _avatar.bots[_botSlot]
        if(
                _bot.bot_id!==_existingBot.bot_id 
            ||  _bot.thread_id!==_existingBot.thread_id
        ){
            console.log(`ERROR: bot discrepency; bot_id: db=${_existingBot.bot_id}, inc=${_bot.bot_id}; thread_id: db=${_existingBot.thread_id}, inc=${_bot.thread_id}`)
            throw new Error('Bot id or thread id cannot attempt to be changed via bot')
        }
        _bot = {..._existingBot, ..._bot}
    } else { // add
        _bot = await mCreateBot(_avatar, _bot) // add in openai
    }
    /* create or update bot properties */
    if(!_bot?.thread_id?.length){
        // openai spec: threads are independent from assistant_id
        // @todo: investigate: need to check valid thread_id? does it expire?
        _bot.thread_id = (await _avatar.setConversation()).thread_id
    }
    // update Cosmos (no need async)
    _avatar.factory.setBot(_bot)
    _bot.active = true
    return _bot
}
/**
 * Requests and returns chat response from openAI. Call session for conversation id.
 * @modular
 * @public
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _chatMessage - Chat message
 * @returns {array} - array of front-end MyLife chat response objects { agent, category, contributions, message, response_time, purpose, type }
 */
async function mChat(_avatar, _chatMessage){
    const _openai = _avatar.ai
    const _processStartTime = Date.now()
    const _conversation = await _avatar.getConversation(_chatMessage.thread_id) // create if not exists
    _conversation.addMessage(_chatMessage)
    //	@todo: assign uploaded files (optional) and push `retrieval` to tools
    await mRunTrigger(_openai, _avatar, _conversation) // run is triggered by message creation, content embedded/embedding now in _conversation in _avatar.conversations
    const _messages = (await _conversation.getMessages_openai())
        .filter(_msg => _msg.run_id == _avatar.runs[0].id)
        .map(_msg => {
            return new (_avatar.factory.message)({
                avatar_id: _avatar.id,
                message: _msg,
                content: _msg.content[0].text.value,
                mbr_id: _avatar.mbr_id,
                role: 'assistant',
            })
        })
    _messages.forEach(async _msg => {
//  @todo: reinstate contribution
//        _avatar.#evolver?.setContribution(_avatar.#activeChatCategory, _msg)??false
        await _conversation.addMessage(_msg)
    })
    //	add/update cosmos
    if ((_avatar?.factory!==undefined) && (process.env?.MYLIFE_DB_ALLOW_SAVE??false)) {
        _conversation.save()
    }
    //	return response
    return _messages
        .map(_msg=>{
            const __message = mPrepareMessage(_msg) // returns object { category, content }
            return {
                agent: 'server',
                category: __message.category,
                contributions: [],
                message: __message.content,
                purpose: 'chat response',
                response_time: Date.now()-_processStartTime,
                thread_id: _conversation.thread_id,
                type: 'chat',
            }
        })
}
/**
 * Creates bot and returns associated `bot` object.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {object} _bot - Bot object
 * @returns {object} - Bot object
*/
async function mCreateBot(_avatar, _bot){
        // create gpt
        const _description = mGetBotDescription(_avatar, _bot.type)
        const _instructions = await mGetBotInstructions(_avatar, _bot)
        const _botName = _bot.bot_name??_bot.name??_bot.type
        const _cosmosName = _bot.name??`bot_${_bot.type}_${_avatar.id}`
        const _botData = {
            being: 'bot',
            bot_name: _botName,
            description: _description,
            instructions: _instructions,
            model: process.env.OPENAI_MODEL_CORE_BOT,
            name: _cosmosName,
            object_id: _avatar.id,
            parent_id: _avatar.id,
            provider: 'openai',
            purpose: _description,
        }
        const _openaiGPT = await mAI_openai(_avatar.ai, _botData)
        _botData.bot_id = _openaiGPT.id
        return { ..._bot, ..._botData }
}
async function mGetAssistant(_openai, _assistant_id){
    return await _openai.beta.assistants.retrieve(_assistant_id)
}
/**
 * Returns MyLife-version of chat category object
 * @modular
 * @public
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
function mGetBotDescription(_avatar, _botType){
    // no need to call db for this, at most, create modular memory cache
    // primarily cosmetic
    return `I am a ${_botType} bot for ${_avatar.memberName}`
}
/**
 * Returns MyLife-version of bot instructions.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {object} _bot - Bot object
 * @returns {string} - flattened string of instructions
 */
async function mGetBotInstructions(_avatar, _bot){
    const _type = _bot?.type
    if(!_type) throw new Error('bot type required to retrieve instructions')
    let _botInstructionSet = await _avatar.factory.botInstructions(_type)
    _botInstructionSet = _botInstructionSet?.instructions
    if(!_botInstructionSet) throw new Error(`bot instructions not found for type: ${_type}`)
    /* compile instructions */
    let _botInstructions = ''
    switch(_type){
        case 'personal-biographer':
            _botInstructions +=
                  _botInstructionSet.preamble
                + _botInstructionSet.purpose
                + _botInstructionSet.prefix
                + _botInstructionSet.general
            break
        default: // avatar
            _botInstructions += _botInstructionSet.general
            break
    }
    /* apply replacements */
    _botInstructionSet.replacements = _botInstructionSet?.replacements??[]
    _botInstructionSet.replacements.forEach(_replacement=>{
        const _placeholderRegExp = _avatar.globals.getRegExp(_replacement.name, true)
        const _replacementText = eval(`_avatar?.${_replacement.replacement}`)
            ?? eval(`_bot?.${_replacement.replacement}`)
            ?? _replacement?.default
            ?? '`unknown-value`'
        _botInstructions = _botInstructions.replace(_placeholderRegExp, () => _replacementText)
    })
    /* apply references */
    _botInstructionSet.references = _botInstructionSet?.references??[]
    _botInstructionSet.references.forEach(_reference=>{
        const _referenceText = _reference.insert
        const _replacementText = eval(`_avatar?.${_reference.value}`)
            ?? eval(`_bot?.${_reference.value}`)
            ?? _reference.default
            ?? '`unknown-value`'
        switch(_reference.method??'replace'){
            case 'append-hard':
                console.log('append-hard::_botInstructions', _referenceText, _replacementText)
                const _indexHard = _botInstructions.indexOf(_referenceText)
                if (_indexHard !== -1) {
                _botInstructions =
                    _botInstructions.slice(0, _indexHard + _referenceText.length)
                    + '\n'
                    + _replacementText
                    + _botInstructions.slice(_indexHard + _referenceText.length)
                }
                break
            case 'append-soft':
                const _indexSoft = _botInstructions.indexOf(_referenceText);
                if (_indexSoft !== -1) {
                _botInstructions =
                      _botInstructions.slice(0, _indexSoft + _referenceText.length)
                    + ' '
                    + _replacementText
                    + _botInstructions.slice(_indexSoft + _referenceText.length)
                }
                break
            case 'replace':
            default:
                _botInstructions = _botInstructions.replace(_referenceText, _replacementText)
                break
        }
    })
    return _botInstructions
}
/**
 * Returns all openai `run` objects for `thread`.
 * @modular
 * @public
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _thread_id - Thread id (from session)
 * @returns {array} - array of [OpenAI run objects](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRuns(_openai, _avatar, _thread_id){
	if(!_avatar.runs){
		_avatar.runs = await _openai.beta.threads.runs
            .list(_thread_id)
	}
}
/* modular "private" functions [unexported] */
/**
 * Cancels openAI run.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {string} _thread_id - Thread id
 * @param {string} _run_id - Run id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mCancelRun(_openai, _thread_id, _run_id,){
    return await _openai.beta.threads.runs.cancel(
        _thread_id,
        _run_id
    )
}
/**
 * Returns simple micro-category after logic mutation.
 * @modular
 * @private
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
async function mHydrateBot(_avatar, _id){
    return await _avatar.bot(_id)
}
/**
 * returns simple micro-message with category after logic mutation. 
 * Currently tuned for openAI gpt-assistant responses.
 * @modular
 * @private
 * @param {string} _msg text of message, currently from gpt-assistants
 * @returns {object} { category, content }
 */
function mPrepareMessage(_msg){
    /* parse message */
    // Regular expression to match the pattern "Category Mode: {category}. " or "Category Mode: {category}\n"; The 'i' flag makes the match case-insensitive
    const _categoryRegex = /^Category Mode: (.*?)\.?$/gim
    const _match = _categoryRegex.exec(_msg)
    const _messageCategory = mFormatCategory(_match?.[1]??'')
    if(_msg.content) _msg = _msg.content
    // Remove from _msg
    _msg = _msg.replace(_categoryRegex, '')
    const _content = _msg.split('\n')
        .filter(_line => _line.trim() !== '') // Remove empty lines
        .map(_msg=>{
            return new Marked().parse(_msg)
        })
        .join('\n')
    return {
        category: _messageCategory,
        content: _content,
    }
}
/**
 * Maintains vigil for status of openAI `run = 'completed'`.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _thread_id - Thread id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunFinish(_openai, _avatar, _thread_id){
    const _run_id = _avatar.runs[0].id // runs[0] just populated, concretize before async
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
            try {
                const status = await mRunStatus(_openai, _avatar, _run_id, _thread_id)
                if (status) {
                    clearInterval(checkInterval)
                    resolve('Run completed')
                }
            } catch (error) {
                clearInterval(checkInterval)
                reject(error)
            }
        }, process.env?.OPENAI_API_CHAT_RESPONSE_PING_INTERVAL??890)
        // Set a timeout to resolve the promise after 55 seconds
        setTimeout(() => {
            clearInterval(checkInterval)
            resolve('Run completed (timeout)')
        }, process.env?.OPENAI_API_CHAT_TIMEOUT??55000)
    })
}
/**
 * Executes openAI run and returns associated `run` object.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _thread_id - Thread id
 * @returns {object} - [OpenAI run object](https://platform.openai.com/docs/api-reference/runs/object)
 */
async function mRunStart(_openai, _avatar, _thread_id){
    return await _openai.beta.threads.runs.create(
        _thread_id,
        { assistant_id: _avatar.assistant.id }
    )
}
/**
 * Checks status of openAI run.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @param {string} _thread_id - Thread id
 * @param {number} _callInterval - Interval in milliseconds
 * @returns {boolean} - true if run completed, voids otherwise
 */
async function mRunStatus(_openai, _avatar, _run_id, _thread_id, _callInterval){
    const _run = await _openai.beta.threads.runs
        .retrieve(
            _thread_id,
            _run_id
        )
    switch(_run.status){
        //	https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
        case 'completed':
            const _runIndex = _avatar.runs.findIndex(__run => __run.id === _run_id)
            if(_runIndex === -1) _avatar.runs.unshift(_run)	//	add
            else _avatar.runs[_runIndex] = _run	//	update via overwrite
            return true
        case 'failed':
        case 'cancelled':
        case 'expired':
            return false
        case 'queued':
        case 'requires_action':
        case 'in_progress':
        case 'cancelling':
        default:
            console.log(`...${_run.status}:${_thread_id}...`) // ping check
            break
    }
}
/**
 * Returns requested openai `run` object.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @param {string} _step_id - Step id
 * @returns {object} - [OpenAI run-step object]()
 */
async function mRunStep(_avatar, _run_id, _step_id){
	//	pull from known runs
	return _avatar.runs
		.filter(_run=>{ return _run.id==_run_id })
		.steps
			.filter(_step=>{ return _step.id==_step_id })
}
/**
 * Returns all openai `run-step` objects for `run`.
 * @modular
 * @private
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _run_id - Run id
 * @returns {array} - array of [OpenAI run-step objects]()
 */
async function mRunSteps(_avatar, _run_id){
	//	always get dynamically
	const _run = _avatar.runs
        .filter(_run=>{ return _run.id==_run_id })
        [0]
	_run.steps = await openai.beta.threads.runs.steps
        .list(_avatar.thread.id, _run.id)
}
/**
 * Triggers openAI run and updates associated `run` object.
 * @modular
 * @private
 * @param {OpenAI} _openai - OpenAI object
 * @param {Avatar} _avatar - Avatar object
 * @param {string} _conversation - Conversation Object
 * @returns {void} - All content generated by run is available in `avatar`.
 */
async function mRunTrigger(_openai, _avatar, _conversation){
    const _run = await mRunStart(_openai, _avatar, _conversation.thread_id)
    if(!_run)
        throw new Error('Run failed to start')
    _avatar.runs = _avatar.runs??[]
    _avatar.runs.unshift(_run)
    // ping status
    return await mRunFinish(_openai, _avatar, _conversation.thread_id)
}
/* exports */
export {
    mAI_openai,
    mAssignEvolverListeners,
    mBot,
    mChat,
    mGetAssistant,
    mGetBotDescription,
    mGetBotInstructions,
    mGetChatCategory,
    mHydrateBot,
    mRuns,
}