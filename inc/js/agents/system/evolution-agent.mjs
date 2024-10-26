//	imports
import { EventEmitter } from 'events'
/* module constants */
const _phases = [
    'create',
    'init',
    'develop',
    'mature',
    'maintain',
    'retire'
]
const _defaultPhase = _phases[0]
/**
 * @class EvolutionAgent
 * @extends EventEmitter
 * Handles the evolutionary process of an avatar, managing its growth and development through various phases, loosely but not solely correlated with timeline.
 * See notes at end for design principles and notes
 */
export class EvolutionAgent extends EventEmitter {
    #avatar //  symbiotic avatar object
    #contributions = [] //  self-managed aray of contributions on behalf of embedded avatar; could postdirectly to avatar when required
    #phase //  create, init, develop, mature, maintain, retire
    /**
     * Constructor Function for Evolution Assistant.
     * @param {Avatar} avatar
    */
    constructor(avatar) { //  receive parent object ref
        super()
        this.#phase = _defaultPhase //  overkill but fun
        this.#avatar = avatar
        this.#advancePhase()    //  phase complete
    }
    //  public functions
    /**
     * Initialize the Evolution Assistant, generating and assigning three Contributions available to the avatar to complete.
     * @public
     * @async
     * @emits {`evo-agent-${phase}-begin`} - Emitted when given phase init() process begins.
     * @emits {`evo-agent-${phase}-end`} - Emitted when the initialization process ends.
     * @returns {Array} An array of three categories most in need of member Contributions.
    */
    async init() {  //  initialize routine populates this.#contributions
        //  validation or other logic
        //  set phase
        await this.#advancePhase()  // subfunction will handle emissions
    }
    /**
     * Proxy to process a Contribution. First update the Contribution object, determining if the Contribution stage is updated. Then evaluate Evolution phase for completeness and advancement.
     * @param {object} _current - Contribution object { category, contributionId, message }
     * @param {object} _proposed - Contribution object { category, contributionId, message }
     * @returns {object} The updated Contribution instantiation.
     */
    setContribution(_current, _proposed) {
        mSetContribution(this, _current, _proposed)
    }
    /* getters/setters */
    /**
     * Get the avatar object.
     * @returns {Avatar} The avatar object.
    */
    get avatar() {
        return this.#avatar
    }
    /**
     * Get the avatar object.
     * @returns {Avatar} The avatar object.
    */
    get being() {
        return this.#avatar.being
    }
    /**
     * Gets the underlying avatar's categories (i.e., current datacore categories)
     * @returns {array} Array of categories.
    */
    get categories() {
        return this.#avatar?.categories??[]
    }
    /**
     * Get the contributions array.
     * @returns {Array} The contributions array.
    */
   get contributions() {
       return this.#contributions
    }
    /**
     * Get the factory object.
     * @returns {AgentFactory} The avatar's factory object.
     */
    get factory() {
        return this.#avatar.factory
    }
    /**
     * Get the owning member id.
     * @returns {string} The avatar member-owner id.
     */
    get mbr_id() {
        return this.#avatar.mbr_id
    }
    /**
     * Get the curent determined phase.
     * @returns {string} The curent phase.
     */
    get phase() {
        return this.#phase
    }
    /* private functions */
    /**
     * Advance the phase of the Evolution Assistant. Logic is encapsulated (here chosen as module private functionality shared amongs evolvers) to ensure that the phase is advanced only when appropriate, ergo, not every request _to_ advancePhase() will actually _do_ so.
     * @private
     * @async
     * @emits {evo-agent-phase-${_startingPhase}-complete} - Emitted on occasion of advancing phase.
     * @returns {void}
     */
    async #advancePhase(){
        const _phaseResults = await mAdvancePhase(this)
        const _startingPhase = this.#phase
        const _proposedPhase = _phaseResults.phase
        this.#contributions = _phaseResults.contributions
        if(_startingPhase !== _proposedPhase){
            this.#phase = _phaseResults.phase
            mLog(`evo-agent-phase-${_startingPhase}-complete`, this)  //  emit event
        }
    }
}
/* module functions */
/**
 * Advance the phase of the Evolution Assistant. Logic is encapsulated to ensure that the phase is advanced only when appropriate, ergo, not every request _to_ advancePhase() will actually _do_ so. Isolates and privatizes logic to propose _advance_ to next phase.
 * @module
 * @emits {evo-agent-phase-change} - Emitted when the phase advances.
 * @param {EvolutionAgent} evoAgent - `this` Evolution Assistant.
 * @returns {string} The determined phase.
 * @todo Implement phase advancement logic for: develop, mature, maintain, retire.
*/
async function mAdvancePhase(evoAgent){  //  **note**: treat parameter `evoAgent` as `read-only` for now
    const _proposal = { //  no need to objectify
        contributions: evoAgent.contributions,
        phase: evoAgent.phase,
        phaseChange: false
    }
    switch(evoAgent.phase) {
        case 'create':  //  initial creation of object, no data yet
        case 'init':    //  need initial basic data for categorical descriptions of underlying data object; think of this as the "seed" phase, where questions are as yet unfit nor personalized in any meaningful way to the underlying core human (or data object), so need to feel way around--questions here could really come from embedding db
            const _formalPhase = 'init'
            if(!evoAgent.categories.length)
                return evoAgent.phase
            if(!evoAgent.contributions.length < 3){    // too low, refresh
                const contributionsPromises = mAssessData(evoAgent)
                    .map(_category => mGetContribution(evoAgent, _category, _formalPhase)) // Returns array of promises
                _proposal.contributions = await Promise.all(contributionsPromises)            }
            // alterations sent as proposal to be adopted (or not, albeit no current mechanism to reject) by instantiated evo-agent [only viable caller by module design]
            _proposal.phase = (mEvolutionPhaseComplete(evoAgent,_formalPhase))
                ? 'init'
                : 'develop'
            _proposal.phaseChange = (_proposal.phase !== 'init')
        case 'develop': //  categories populated, need to develop/enhance/add categories
            break
        case 'mature':  //  categories fully summarized, need to generate children objects to independently manage shards of data, so object strings (ex., beliefs="I believe it all") become robust enough to self-generate its own super-intelligence via LLM (i.e., document in Cosmos)
            break
        case 'maintain':   //  contributions have tapered off, need to maintain data integrity and consent security
            break
        case 'retire':  //  contributions have ceased with request to retire object; would never happen with core, but certainly can with any other spawned object; **note** not deletion or removal at this point, but rather a request to stop contributing to the object, lock it and archive; of course could be rehydrated at any time, but from cold state or colder
            break
        default:
            //  throw new Error(`unknown phase: ${evoAgent.phase}`)
    }
    return _proposal
}
/**
 * Reviews properties of avatar and returns an array of three categories most in need of member Contributions.
 * @module
 * @param {EvolutionAgent} evoAgent - The avatar evoAgent whose data requires assessment.
 * @param {number} _numCategories - The number of categories to return. Defaults to 5. minimum 1, maximum 9.
 * @returns {Array} The top number categories requiring Contributions.
*/
function mAssessData(evoAgent, _numCategories) {
    const _defaultNumCategories = 5
    const _maxNumCategories = 9
    return [
        ...mAssessNulls(evoAgent),
        ...mAssessNodes(evoAgent)
            .slice(0, _numCategories || _defaultNumCategories)
    ]
        .slice(0, Math.min(_numCategories || _defaultNumCategories, _maxNumCategories))
}
/**
 * Asses nodes for categories to contribute to.
 * @param {EvolutionAgent} evoAgent 
 * @returns {Array} The categories to contribute to.
*/
function mAssessNodes(evoAgent){
    return evoAgent.categories
    .filter(_category => evoAgent?.[mFormatCategory(_category)])
    .map(_category => mFormatCategory(_category))
    .sort((a, b) => evoAgent[a].length - evoAgent[b].length)
}
function mAssessNulls(evoAgent) {
    return evoAgent.categories
        .filter(_category => !evoAgent?.[mFormatCategory(_category)])
        .map(_category => mFormatCategory(_category))
        .sort(() => Math.random() - 0.5)
}
/**
 * Assign listeners to a Contribution object.
 * @param {EvolutionAgent} evoAgent - `this` Evolution Assistant.
 * @param {Contribution} _contribution - The Contribution object to assign listeners to.
*/
function mAssignContributionListeners(evoAgent, _contribution) {
     // **note**: logging exact text of event for now, but could be more generic
    _contribution.on(
        'on-contribution-new',
        _contribution => { // todo: do not add contributions to anything but Member

        }
    )
    _contribution.on(
        'on-contribution-prepared',
        _contribution => {

        }
    )
    _contribution.on(
        'on-contribution-submitted',
        _contribution => {

        }
    )
}
/**
 * Determines whether the given phase is complete.
 * @module
 * @param {EvolutionAgent} evoAgent - `this` Evolution Assistant.
 * @param {string} _phase - The phase to check for completion.
*/
function mEvolutionPhaseComplete(evoAgent,_phase) {
    switch (_phase) {
        case 'init':
            //  if category data nodes exist that have no data, return false
            return (evoAgent.categories)
        default:    //  such as `create`
            return true
    }
}
/**
 * Formats a category string to a format consistent with Cosmos key structure: all lowercase, underscores for spaces, limit of 64-characters.
 * @module
 * @param {string} _category - The category to format.
 * @returns {string} The formatted category.
*/
function mFormatCategory(_category) {
   return _category
       .replace(/\s+/g, '_')
       .toLowerCase()
       .trimStart()
       .slice(0, 64)
}
/**
 * Digest a request to generate a new Contribution.
 * @module
 * @emits {on-contribution-new} - Emitted when a new Contribution is generated.
 * @param {EvolutionAgent} evoAgent - `this` Evolution Assistant.
 * @param {string} _category - The category to process.
 * @param {string} _phase - The phase to process.
 * @returns {Contribution} A new Contribution object.
*/
async function mGetContribution(evoAgent, _category, _phase) {
    const _avatar = evoAgent.avatar
    _category = mFormatCategory(_category)
    // Process question and map to `new Contribution` class
    const _contribution = new (_avatar.factory.contribution)({
        avatar_id: _avatar.id,
        context: `I am a contribution object in MyLife, comprising data and functionality around a data evolution request to my associated avatar [${_avatar.id}]`,
//        id: _avatar.factory.newGuid,
        mbr_id: _avatar.mbr_id,    //  Contributions are system objects
        phase: _phase,
        purpose: `Contribute to the data evolution of underlying avatar for category [${_category}]`,
        request: {
            category: _category,
            content: _avatar?.[_category]??false,
            impersonation: _avatar.being,
            phase: _phase,
        },
        responses: [],
    })
    mAssignContributionListeners(evoAgent, _contribution)
    return await _contribution.init(_avatar.factory)   //  fires emitters
}
/**
 * Log an object to the console and emit it to the parent.
 * @module
 * @emits {_emit_text} - Emitted when an object is logged.
 * @param {string} _emit_text - The text to emit.
 * @param {EvolutionAgent} evoAgent - `this` Evolution Assistant.
 * @param {object} _object - The object to log, if not evoAgent.
*/
function mLog(_emit_text,evoAgent,_object) {
    if(_emit_text) evoAgent.emit(_emit_text, _object??evoAgent) // incumbent upon EvoAgent to incorporate child emissions into self and _then_ emit here
}
/**
 * Process a Contribution. First update the Contribution object, determining if the Contribution stage is updated. Then evaluate Evolution phase for completeness and advancement.
 * @module
 * @param {EvolutionAgent} evoAgent - `this` Evolution Assistant.
 * @param {Array} _contributions - The contributions array.
 * @param {object} _current - Contribution object { category, contributionId, message }
 * @param {object} _proposed - Contribution object { category, contributionId, message }
 * @returns {object} The updated Contribution instantiation.
*/
function mSetContribution(evoAgent, _current, _proposed) {
    /* update Contribution */
    if(_proposed?.contributionId){
        evoAgent.contributions
            .find(_contribution => _contribution.id === _proposed.contributionId)
            .update(_proposed) // emits avatar update event
    }
    /* evolve phase */
    if(_current?.category!==_proposed.category){
        evoAgent.emit('avatar-change-category', _current, _proposed)
        if(_current?.contributionId){
        /* @todo: verify that categories are changing */
            const _currentContribution = evoAgent.contributions
                .find(_contribution => _contribution.id === _current.contributionId)
            console.log('evolution-assistant:mSetContribution():320', _currentContribution.inspect(true))
            if(_currentContribution.stage === 'prepared'){ // ready to process
                // join array and submit for gpt-summarization
                mSubmitContribution(evoAgent, _contributions.responses.join('\n'))
                // advance phase, write db, emit event
            }
        }
    }
}
async function mSubmitContribution(evoAgent, _contribution) {
    // emit to avatar => (session?) => datacore
    _contribution.emit('on-contribution-submitted', _contribution)
}
// exports
export default EvolutionAgent