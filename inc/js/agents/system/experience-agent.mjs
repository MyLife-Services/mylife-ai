import LLMServices from "../../mylife-llm-services.mjs"
import BotAgent from "./bot-agent.mjs"
import { Marked } from 'marked'
/* module constants */
const mAvailableEventActionMap = {
    dialog: {
        effects: ['spotlight'],
        types: ['script', 'prompt'],
    },
    input: {},
}
const mDefaultScriptAdvisorLLMId = 'asst_NonLpXQ5maLpIciwxwGqsMwV'
let mActor,
    mActorQ
/* class definitions */
/**
 * @class Actor
 * An `actor` is a bot that can be used in an `experience` to interact with a Member Avatar. The Actor can be a system bot, (either a generic actor or an instance of `Q`), or a known bot specific to a Member Avatar.
 */
class Actor {
    #bot
    constructor(Bot){
        // @todo - In system cases (Actor and Q), this is a data object not an instance!
        this.#bot = Bot
    }
    /* getters/setters */
    get bot(){
        return this.#bot?.bot
            ?? this.#bot
    }
    get bot_id(){
        return this.#bot?.id
            ?? this.id
    }
}
/**
 * @class CastMember
 * A `cast member` is an `actor` that is part of the `cast` of an `experience`. The `cast member` can be a system actor, a system bot, or a known bot specific to a Member Avatar, but these aspects and characteristics are managed generically by the underlying Actor for now.
 */
class CastMember extends Actor {
    #factory
    #id
    #name
    #type
    constructor(obj, Bot, Factory){
        super(Bot)
        this.#factory = Factory
        const { id, name, type, ..._obj } = obj
        this.#id = id
        this.#name = name
        this.#type = type
        Object.assign(this, _obj)
    }
    /* getters/setters */
    get castMember(){
        return {
            icon: this.icon,
            id: this.#id,
            name: this.#name,
            role: this.role,
            type: this.#type,
            url: this.url,
        }
    }
    get id(){
        return this.#id
    }
    get name(){
        return this.#name
    }
    set name(name){
        this.#name = name
    }
    get type(){
        return this.#type
    }
}
/**
 * @class Experience
 * An `experience` is the unit of demonstration of a particular pre-built script by MyLife (or Member) _or_ the execution of illustration of a memory, idea, or other database `item` that can be rendered experientially. The Experience Agent can manage multiple `experiences` of this ilk.
 * @todo - add `scriptAdvisor` to Experience, which would be a separate conversation for the scriptAdvisor bot to determine success conditions for scene, etc.
 */
class Experience {
    #botAgent
    #cast
    #conversations=[]
    #events=[]
    #factory
    #id
    #llm
    #location
    #memberDialog
    #navigation
    #running=false
    #scenes
    #scriptAdvisorLlmId
    #scriptDialog
    #scriptVariables
    #variables
    constructor(obj, botAgent, llm, Factory, avatarExperienceVariables){
        const { being, cast, dates, events, id, mbr_id, name, public: publicExperience, scenes, scriptAdvisorBotId, status, variables: scriptVariables, ..._obj } = obj
        if(!publicExperience)
            throw new Error('Experience is not public')
        if(status!=='active')
            throw new Error('Experience is not active')
        if(dates?.runStart && dates.runStart > Date.now())
            throw new Error('Experience has not started')
        if(dates?.runEnd && dates.runEnd < Date.now())
            throw new Error('Experience has ended')
        if(!cast || !cast.length)
            throw new Error('Experience has no cast')
        if(!scenes || !scenes.length)
            throw new Error('Experience has no scenes')
        this.#botAgent = botAgent
        this.#scenes = scenes
        this.#factory = Factory
        this.#llm = llm
        this.#id = id
        this.#scriptAdvisorLlmId = scriptAdvisorBotId
            ?? mDefaultScriptAdvisorLLMId
        this.#scriptVariables = scriptVariables
        this.#cast = mCast(cast, this.#botAgent, this.#factory)
        this.#location = mLocation(this)
        this.#navigation = mNavigation(this.#scenes)
        obj = this.#factory.globals.sanitize(_obj)
        Object.assign(this, obj)
        this.#variables = avatarExperienceVariables
    }
    /* public functions */
    async getScriptDialog(prompt){
        const { scriptDialog, } = this
        if(prompt?.length)
            scriptDialog.prompt = prompt
        await this.#botAgent.chat(scriptDialog, false)
        const messages = scriptDialog.getMessages()
        return messages
    }
    end(){
        this.#running = false
    }
    event(eid){
        return this.#events.find(event=>event.id===eid)
    }
    async run(memberInput){
        console.log('Experience.run', memberInput)
        if(!this.#running)
            await mExperienceStart(this, this.#botAgent)
        await mExperienceRun(memberInput, this)
        this.#running = true
    }
    scene(sid, eid){
        const scene = sid
            ? this.#scenes.find(scene=>scene.id===sid)
            : this.#scenes.find(scene=>scene.events.some(event=>event.id===eid))
        return scene

    }
    sceneNext(sid){
        const sceneIndex = this.scriptScenes.findIndex(scene=>scene.id===sid)
        const nextScene = this.scriptScenes?.[sceneIndex+1]
        return nextScene
    }
    /* getters/setters */
    get cast(){
        return this.#cast
    }
    get conversations(){
        return this.#conversations
    }
    get events(){
        return this.#events
    }
    get id(){
        return this.#id
    }
    get location(){
        return this.#location
    }
    set location(location){
        this.#location = location
    }
    get manifest(){
        return {
            cast: this.#cast.map(castMember=>castMember.castMember),
            navigation: this.#navigation,
        }
    }
    get memberDialog(){
        return this.#memberDialog
    }
    set memberDialog(Conversation){
        this.#memberDialog = Conversation
    }
    get scenes(){
        return this.#scenes
    }
    get script(){
        return this.scenes
    }
    get scriptAdvisorLlmId(){
        return this.#scriptAdvisorLlmId
    }
    get scriptDialog(){
        return this.#scriptDialog
    }
    set scriptDialog(Conversation){
        this.#scriptDialog = Conversation
    }
    get scriptEvents(){
        return this.scenes.flatMap(scene=>scene.events)
    }
    get scriptScenes(){
        return this.scenes.map(scene=>{
            const { events, ..._scene } = scene
            return _scene
        })
    }
    get scriptVariables(){
        return this.#scriptVariables
    }
    get variables(){
        return this.#variables
    }
}
/* ExperienceAgent class */
/**
 * @class ExperienceAgent
 * Handles the `experience` process for a Member Avatar, with mutual integrity, allowing for internalized (but unrevealed) instance of the Member Avatar and the accompanying BotAgent. Can run one Experience at a time.
 */
class ExperienceAgent {
    /* private properties */
    #avatar
    #botAgent
    #experiences=[]
    #livedExperiences=[]
    #factory
    #llm
    #variables
    /**
     * Constructor for ExperienceAgent.
     * @param {Object} obj - The object to be used to create data for the instance
     * @param {BotAgent} BotAgent - BotAgent instance
     * @param {LLMServices} LLMServices - LLMServices instance
     * @param {Factory} Factory - Factory instance
     * @param {Avatar} Avatar - Avatar instance
    */
    constructor(obj={}, BotAgent, LLMServices, Factory, Avatar, avatarVariables){
        this.#avatar = Avatar
        this.#botAgent = BotAgent
        this.#factory = Factory
        if(!mActor)
            mActor = Factory.actor
        if(!mActorQ)
            mActorQ = Factory.actorQ
        this.#llm = LLMServices
        obj = this.#factory.globals.sanitize(obj)
        Object.assign(this, obj)
        this.id = this.#factory.newGuid
        this.#variables = avatarVariables
    }
    /* public functions */
    /**
     * Starts, continues or resumes the specified experience.
     * @param {Guid} xid - The experience id
     * @param {string} memberInput - The member input
     * @returns {Promise<Experience>}
     */
    async experience(xid, memberInput){
        let Experience = this.findExperience(xid)
        if(!Experience){
            const experienceData = await this.#factory.getExperience(xid)
            Experience = mExperience(experienceData, this.#botAgent, this.#llm, this.#factory, this.#variables)
            this.#experiences.push(Experience)
        }
        console.log()
        await Experience.run(memberInput)
        return Experience
    }
    /**
     * Ends an experience.
     * @public
     * @param {Guid} xid - The experience id
     * @returns {void}
     */
    experienceEnd(xid){
        const index = this.#experiences.findIndex(experience=>experience.id===xid)
        if(index!==-1){
            const [Experience] = this.#experiences.splice(index, 1)
            Experience.end()
            this.#livedExperiences.push(Experience)
        }
    }
    experienceManifest(xid){
        return this.findExperience(xid)?.manifest
    }
    /**
     * Returns the list of experiences available for the member.
     * @param {boolean} includeLived - Include lived experiences in the list
     * @returns {Promise<Object[]>} - Array of shorthand experience payloads: { autoplay, description, id, name, purpose, skippable, }
     */
    async experiences(includeLived=false){
        const experiences = await mExperiences(includeLived, this.#factory)
        return experiences
    }
    experiencesActive(){
        return this.#experiences
    }
    findExperience(xid){
        return this.#experiences.find(experience=>experience.id===xid)
    }
    /* getters/setters */
	get actor(){
		return this.#factory.actor
	}
	get actorQ(){
		return this.#factory.actorQ
	}
    get mbr_id(){
        return this.#avatar.mbr_id
    }
    get newGuid(){
        return this.#factory.newGuid
    }
    get variables(){
        return this.#variables
    }
    /* private functions */
}
/* ExperienceEvent class */
class ExperienceEvent {
    #action
    #id
    #order
    #portrayed
    constructor(obj){
        const { action, id, order, portrayed, ..._obj } = obj // note: portrayed is forcibly assigned by Avatar
        this.#action = action
        this.#id = id
        this.#order = order
        this.#portrayed = false
        Object.assign(this, _obj)
    }
    /* getters/setters */
    get action(){
        return this.#action
    }
    get event(){
        const { action, character, breakpoint, complete, dialog, id, input, order, sid, skip=false, stage, type, useDialogCache, xid, } = this
        return {
            action,
            character,
            breakpoint,
            complete,
            dialog,
            id,
            input,
            order,
            sid,
            skip,
            stage,
            type,
            useDialogCache,
            xid,
        }
    }
    get id(){
        return this.#id
    }
    get order(){
        return this.#order
    }
    get portrayed(){
        return this.#portrayed
    }
    set portrayed(portrayed){
        this.#portrayed = !!portrayed
    }
}
/* module functions */
/**
 * Creates cast and returns associated `cast` object.
 * @module
 * @param {Object[]} cast - Array of cast data objects
 * @param {BotAgent} botAgent - BotAgent instance
 * @param {Factory} Factory - Factory object
 * @returns {Promise<array>} - Array of CastMember instances
 */
function mCast(cast, botAgent, Factory){
    cast = cast.map(castMember=>{
        castMember = Factory.globals.sanitize(castMember)
        const { form, type, } = castMember
        let Bot
        switch(type.toLowerCase()){
            case 'actor': // system actor
            case 'system':
                Bot = Factory.actor
                break
            case 'mylife': // Q
            case 'q':
                Bot = Factory.actorQ
                break
            case 'bot': // identified member-specific bot
            case 'member':
            case 'member-bot':
            default:
                Bot = botAgent.bot(null, form)
                break
            }
        const Actor = new CastMember(castMember, Bot, Factory)
        return Actor
    })
    return cast
}
/**
 * From an event, returns a `synthetic` Dialog data package, see JSDoc properties.
 * @module
 * @public
 * @param {object} dialog - Event instance dialog object
 * @param {number} iteration - Iteration number, defaults to first (array zero format)
 * @returns {object} - `synthetic` Dialog data package: { animation, animationDetail, animationDelay, animationDuration, currentIteration, dialog, effect, example, id, type, maxIterations, minIterations, prompt, variable, variables, }
 */
function mDialog(dialog, iteration=0){
    /* validate */
    const { animation, animationDetail, animationDelay, animationDuration, dialog: characterDialog, effect, example, maxIterations=1, minIterations=1, text, type='script', variable: dialogVariable, variables: dialogVariables=[] } = dialog
    let { prompt, } = dialog
    if(!mAvailableEventActionMap.dialog.types.includes(type))
        throw new Error(`mDialog: Event.type must be one of ${ mAvailableEventActionMap.dialog.types.join(', ') }`)
    /* compile */
    dialog = Array.isArray(characterDialog)
        ? (characterDialog?.[iteration]
            ?? characterDialog[0])
        : characterDialog
    prompt = Array.isArray(prompt)
        ? (prompt?.[iteration] ?? prompt[0])
        : prompt
    if(dialogVariable && !dialogVariables.includes(dialogVariable))
        dialogVariables.push(dialogVariable)
    /* return */
    return {
        animation,
        animationDetail,
        animationDelay,
        animationDuration,
        currentIteration: iteration,
        dialog,
        effect,
        example,
        maxIterations,
        minIterations,
        type,
        prompt,
        variables: dialogVariables,
    }
}
/**
 * Takes character data and makes necessary adjustments to roles, urls, etc.
 * @param {Experience} Experience - Experience instance
 * @param {Object} character - Synthetic character object
 */
async function mEventCharacter(Experience, character){
    const { cast, variables: experienceVariables, } = Experience
    const { characterId, name, role, variables, } = character
    const castMember = cast.find(castMember=>castMember.id===characterId)
    if(!castMember)
        throw new Error('Character not found in cast')
    if(name)
        castMember.name = name.includes('@@') 
            ? mReplaceVariables(name, variables, experienceVariables)
            : name
    if(role){
        castMember.role = role.includes('@@')
            ? mReplaceVariables(role, variables, experienceVariables)
            : role
        character.role = castMember.role
    }
    return character
}
/**
 * Returns processed dialog as string.
 * @module
 * @public
 * @param {ExperienceEvent} Event - Event instance
 * @param {Experience} Experience - Experience instance
 * @param {number} iteration - The current iteration number (iterations _also_ allow for `refresh` of dialog front-end)
 * @returns {Promise<string>} - Parsed event dialog
 */
async function mEventDialog(Event, Experience, iteration=0){
    const { character, dialog: eventDialog, id: eid, useDialogCache, } = Event
    if(!eventDialog || !Object.keys(eventDialog).length)
        return // no dialog to parse
    if(useDialogCache){
        const livedEvent = Experience.events.find(event=>event.id===eid)
        if(livedEvent)
            return livedEvent.dialog.dialog
    }
    if(!character)
        throw new Error('Dialog error, no character identified')
    const { characterId: _id, id } = character
    const characterId = id
        ?? _id
    let dialog = mDialog(eventDialog, iteration)
    if(!dialog)
        throw new Error('Dialog error, could not establish dialog')
    const { content, dialog: dialogText, example, prompt: dialogPrompt, text, type, variables } = dialog
    const dialogVariables = variables
        ?? Event.variables
        ?? []
    switch(type){
        case 'script':
            let scriptedDialog = dialogText
                ?? text
                ?? dialogPrompt
                ?? content
            if(!scriptedDialog)
                throw new Error('Script line requested, no content identified')
            if(dialogVariables.length && scriptedDialog.includes('@@'))
                scriptedDialog = mReplaceVariables(scriptedDialog, dialogVariables, Experience.variables)
            return scriptedDialog
        case 'prompt':
            if(!dialogPrompt)
                throw new Error('Dynamic script requested, no prompt identified')
            let prompt = dialogPrompt
            const { cast, memberDialog, scriptAdvisorBotId, scriptDialog, variables: experienceVariables, } = Experience
            const castMember = cast.find(castMember=>castMember.id===characterId)
            const { bot, } = castMember
            const { llm_id, id, } = bot
            if(!llm_id || !id)
                throw new Error(`mEventDialog()::Bot id: ${ characterId } not found in cast`)
            scriptDialog.llm_id = llm_id
                ?? scriptAdvisorBotId
            if(example?.length)
                prompt = `using example: "${ example }";\n` + prompt
            if(dialogVariables.length)
                prompt = mReplaceVariables(prompt, dialogVariables, experienceVariables)
            const messages = await Experience.getScriptDialog(prompt)
            if(!messages?.length)
                console.log('mEventDialog::no messages returned from LLM', prompt, llm_id)
            scriptDialog.addMessages(messages)
            memberDialog.addMessage(scriptDialog.mostRecentDialog)
            const responseDialog = new Marked().parse(memberDialog.mostRecentDialog)
            return responseDialog
        default:
            throw new Error(`Dialog type \`${ type }\` not recognized`)
    }   
}
/**
 * Returns a processed memberInput event.
 * @todo - once conversations are not spurred until needed, add a third conversation to the experience, which would be the scriptAdvisor (not actor) to determine success conditions for scene, etc.
 * @todo - handle complex success conditions
 * @module
 * @public
 * @param {object} memberInput - Member input, any data type
 * @param {ExperienceEvent} Event - Event object
 * @param {Experience} Experience - Experience instance
 * @param {number} iteration - The current iteration number
 * @returns {Promise<object>} - Synthetic Input Event
 * @note - review https://platform.openai.com/docs/assistants/tools/defining-functions
 */
async function mEventInput(memberInput, Event, Experience, iteration=0){
    const { character, id: eid, input, type='script' } = Event
    const { characterId: _id, id } = character
    const cid = id
        ?? _id
    const { dialog, events, scriptAdvisor, scriptDialog, } = Experience
    const hasMemberInput = memberInput && (
            ( typeof memberInput==='object' && Object.keys(memberInput)?.length )
         || ( typeof memberInput==='string' && ( memberInput.trim().length ?? false ) )
         || ( Array.isArray(memberInput) && memberInput.length && memberInput[0])
        )
    const livingEvent = events.find(event=>event.id===eid)
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
                    memberInput = memberInput?.[0]
                        ?? ''
                    break
                case 'object':
                    // grab first key, ought have been string
                    memberInput = Object.values(memberInput)?.[0]
                        ?? ''
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
    const scriptAdvisorBotId = Experience.scriptAdvisorBotId
        ?? Experience.cast.find(castMember=>castMember.id===cid)?.bot?.llm_id
        ?? Experience.cast[0]?.bot?.llm_id
    const scriptConsultant = scriptAdvisor
        ?? scriptDialog
        ?? dialog
    scriptConsultant.llm_id = scriptAdvisorBotId
    const messages = await Experience.getScriptDialog(prompt)
    if(!messages?.length){
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
    input.variables.forEach(variable=>{ // when variables, add/overwrite `Experience.variables`
        Experience.variables[variable] = evaluationResponse.outcome?.[variable]
            ?? evaluationResponse?.[variable] // when wrong bot used, will send back raw JSON object
            ?? Experience.variables?.[variable]
            ?? evaluationResponse
    })
    if(typeof input.success === 'object'){ // @stub - handle complex object success object conditions
        // denotes multiple potential success outcomes, currently scene/event branching based on content
        // See success_complex in API script, key is variable, value is potential values _or_ event guid
        // loop through keys and compare to Experience.experienceVariables
    }
    input.complete = !!input?.success
        ?? false
    Event.portrayed = input.complete
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
 * @param {object} memberInput - Member input
 * @param {ExperienceEvent} Event - Event object
 * @param {Experience} Experience - Experience instance
 * @returns {Promise<ExperienceEvent>} - Event object
 */
async function mEventProcess(memberInput, Event, Experience){
    const { id: xid, location, memberDialog, scriptDialog, variables, } = Experience
    const { action, id: eid } = Event
    let { character, dialog, input, stage, } = Event
    switch(action){ // **note**: intentional pass-throughs on `switch`
        case 'input':
            if(input && Object.keys(input).length){
                const _input = await mEventInput(memberInput, Event, Experience)
                memberInput = undefined // clear for next event
                input = _input
                Event.complete = input.complete
                Event.skip = input.complete // member input need not be in Event scheme
                Event.useDialogCache = input.useDialogCache
            }
            if(Event.complete)
                break
        case 'dialog': // dialog from inputs cascading down already have iteration information
            if(dialog && Object.keys(dialog).length)
                dialog.dialog = await mEventDialog(Event, Experience)
        case 'character':
            if(character && Object.keys(character).length)
                character = await mEventCharacter(Experience, character)
        case 'stage':
            if(stage && Object.keys(stage).length)
                stage = mEventStage(llm, Experience, stage)
            Event.complete = Event.complete
                ?? true // when `false`, value retained
            break
        default:
            throw new Error('Event action not recognized')
    }
    /* update location pointers */
    Experience.events.push(Event)
    Experience.location.eid = eid
    Experience.location.iteration = Event.complete
        ? 0
        : location.iteration + 1
    return Event
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
 * Instantiates an experience instance from experience data.
 * @param {object} experienceData - Experience data object
 * @param {BotAgent} botAgent - BotAgent instance
 * @param {LLMServices} llm - LLMServices instance
 * @param {Factory} factory - Factory instance
 * @param {object} experienceVariables - Experience variables
 * @returns {Promise<Experience>}
 */
function mExperience(experienceData, botAgent, llm, factory, experienceVariables){
    return new Experience(experienceData, botAgent, llm, factory, experienceVariables)
}
/**
 * Runs the Experience, processing upcoming events and scenes for payload.
 * @param {string} memberInput - Member input
 * @param {Experience} Experience - Experience instance
 * @returns {Promise<Object[]>} - Array of event payloads
 */
async function mExperienceRun(memberInput, Experience){
    const { sid, eid, xid, } = Experience.location
    const scene = Experience.scene(sid)
    let eventIndex=scene.events.findIndex(event=>event.id===eid),
        sceneComplete = true // when no breakpoints
    const originalEventIndex = eventIndex
    while(scene.events?.[eventIndex]){
        const Event = new ExperienceEvent(scene.events[eventIndex])
        await mEventProcess(memberInput, Event, Experience)
        if(memberInput) // clear for next Event (or loop!)
            memberInput = null
        if(!Event.complete){
            sceneComplete = false
            break
        }
        eventIndex++
    }
    /* end-of-scene */
    if(sceneComplete){
        const nextScene = Experience.sceneNext(sid)
        let sequenceEnd
        if(nextScene){
            sequenceEnd = { // end current scene
                action: 'end',
                complete: true,
                id: sid,
                eid,
                sid,
                title: scene.title,
                type: 'scene',
                xid,
            } // provide marker for front-end [end of event sequence]; begin next scene with next request
            Experience.location.sid = nextScene.id
            Experience.location.eid = nextScene.events[0].id
        } else {
            /* end-of-experience */
            const { developers, goal, name: experienceName, } = Experience
            const name = experienceName
                ?? 'MyLife Experience'
            const { title=name, } = Experience
            sequenceEnd = {
                action: 'end',
                complete: true,
                developers,
                goal,
                id: xid,
                name,
                title,
                type: 'experience',
                xid,
            } // provide marker for front-end [end of event sequence]
            Experience.location.completed = true
        }
        if(sequenceEnd)
            Experience.events.push(sequenceEnd)
    }
}
/**
 * Takes an experience document and converts it to use by frontend. Also filters out any inappropriate experiences.
 * @param {boolean} includeLived - Include lived experiences in the list
 * @param {Factory} factory - Factory instance
 * @returns {Object[]} - Array of shorthand experience payloads: { autoplay, description, id, name, purpose, skippable, }
 */
async function mExperiences(includeLived, factory){
    let experiences = await factory.experiences(includeLived)
    experiences = experiences
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
        .map(experience=>{ // shorthand payload
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
    return experiences
}
/**
 * Starts Experience, sets internal variables and further hydrates Experience object.
 * @param {Experience} Experience - The Experience instance
 * @param {BotAgent} botAgent - BotAgent instance
 * @returns {Promise<void>}
 */
async function mExperienceStart(Experience, botAgent){
    /* assign living experience */
    // Instead, these moderating elements to Experience
    const [memberDialog, scriptDialog] = await Promise.all([
        botAgent.conversationStart('experience'),
        botAgent.conversationStart('dialog')
    ])
    Experience.memberDialog = memberDialog
    Experience.scriptDialog = scriptDialog
}
/**
 * From an event, returns a `synthetic` Input data package.
 * @module
 * @public
 * @param {ExperienceEvent} Event - Event instance
 * @param {number} iteration - Iteration number, defaults to first (array zero format)
 * @returns {object} - `synthetic` Input data package: { complete, condition, currentIteration, failure, followup, inputId, inputPlaceholder, inputShadow, inputType, inputVariableName, outcome, success, type, variables, }
 */
function mInput(Event, iteration=0){
    const { data: eventData, id: eid, type: eventType, variable: eventVariable, variables: eventVariables } = Event
    const { condition, failure, followup, inputId, inputPlaceholder, inputShadow, inputType, outcome, success, type, variable, variables } = eventData
    // add synthetic input object
    const input = {
        complete: false, // default is false, true would indicate that input has been successfully complete
        condition: condition, // true would indicate that any input is successful, presume to trim, etc
        currentIteration: iteration,
        failure: failure, // default is to stay on current event
        followup: followup
            ?? 'Something went wrong, please enter again.',
        inputId: inputId
            ?? eid,
        inputPlaceholder: inputPlaceholder
            ?? 'Type here...',
        inputShadow: inputShadow
            ?? 'Please enter your response below',
        inputType: inputType
            ?? type
            ?? 'text',
        inputVariableName: variable
            ?? variables?.[0]
            ?? eventVariable
            ?? eventVariables?.[0]
            ?? 'input',
        outcome: outcome, // no variables, just success boolean
        success: success, // what system should do on success, guid for eid or default is next
        useDialogCache: false, // if true, will use dialog cache (if exists) for input and dialog (if dynamic)
        variables: variables
            ?? eventVariables
            ?? ['input'],
    }
    return input
}
/**
 * Creates a current location payload for the experience.
 * @param {Experience} Experience - The Experience instance
 * @param {Guid} eid - The event id
 * @returns {Object} - The location object for the experience: { eid, iteration, sid, xid: experienceId, }
 */
function mLocation(Experience, eid){
    const { id: xid, scriptEvents, } = Experience
    eid = eid
        ?? scriptEvents[0].id
    const iteration = 0
    const sid = Experience.scene(null, eid).id
    return { xid, eid, iteration, sid, }
}
/**
 * Get experience scene navigation array.
 * @getter
 * @returns {Object[]} - The scene navigation array for the experience: { backdrop, id, description, order, required, skippable, title, type, }
 */
function mNavigation(scenes){
    return scenes
        .map(scene=>{
            const { backdrop, hooks, description, id: sid, order, required=false, skippable=true, title=`untitled`, type, } = scene
            return {
                backdrop,
                description,
                order,
                required,
                sid,
                skippable,
                title,
                type,
            }
        })
        .sort((a,b)=>{
            return (a.order ?? 0) - (b.order ?? 0)
        })
}
/**
 * Replaces variables in prompt with Experience values.
 * @todo - variables should be back populated to experience, confirm
 * @todo - events could be identified where these were input if empty
 * @module
 * @private
 * @param {string} prompt - Dialog prompt, replace variables
 * @param {string[]} variableList - List of variables to replace
 * @param {object} variableValues - Object with variable values
 * @returns {string} - Dialog prompt with variables replaced
 */
function mReplaceVariables(prompt, variableList, variableValues){
    variableList.forEach(keyName=>{
        const value = variableValues[keyName]
        if(value)
            prompt = prompt.replace(new RegExp(`@@${keyName}`, 'g'), value)
    })
    return prompt
}
/* exports */
export default ExperienceAgent