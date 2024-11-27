/* module constants */
/* ExperienceAgent class */
/**
 * @class ExperienceAgent
 * Handles the `experience` process for a Member Avatar, with mutual integrity, allowing for internalized (but unrevealed) instance of the Member Avatar and the accompanying BotAgent. Can run one Experience at a time.
 */
export class ExperienceAgent {
    /* private properties */
    #avatar
    #botAgent
    #experience
    #factory
    #llm
    /**
     * Constructor for ExperienceAgent.
     * @param {Object} obj - The object to be used to create data for the instance
     * @param {BotAgent} BotAgent - BotAgent instance
     * @param {LLMServices} LLMServices - LLMServices instance
     * @param {Factory} Factory - Factory instance
     * @param {Avatar} Avatar - Avatar instance
    */
    constructor(obj={}, BotAgent, LLMServices, Factory, Avatar){
        this.#avatar = Avatar
        this.#botAgent = BotAgent
        this.#factory = Factory
        this.#llm = LLMServices
        Object.assign(this, obj)
        this.id = this.#factory.newGuid
    }
    /* public functions */
    /**
     * Initializes ExperienceAgent with new `experience` by `id`.
     * @param {Guid} xid - The `id` of the experience to be initialized
     * @returns {Promise<ExperienceAgent>} - The initialized ExperienceAgent instance
     */
    async init(xid){
        if(!!this.#experience)
            throw new Error('ExperienceAgent already initialized; end the current experience before initializing a new one.')
        this.#experience = await this.#factory.getExperience(xid)
        return this
    }
    end(){
        this.#experience = null
    }
    /**
     * Returns the list of experiences available for the member.
     * @param {boolean} includeLived - Include lived experiences in the list
     * @returns {Promise<Object[]>} - Array of shorthand experience payloads: { autoplay, description, id, name, purpose, skippable, }
     */
    async experiences(){
        const experiences = mExperiences(await this.#factory.experiences(includeLived))
        return experiences
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
    /* private functions */
}
/* module functions */

/**
 * Takes an experience document and converts it to use by frontend. Also filters out any inappropriate experiences.
 * @param {array<object>} experiences - Array of Experience document objects.
 * @returns {array<object>} - Array of shorthand experience payloads: { autoplay, description, id, name, purpose, skippable, }
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
/* exports */
export default ExperienceAgent