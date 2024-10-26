/* module constants */
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
        this.#experience = await this.#botAgent.getExperience(xid)
        return this
    }
    end(){
        this.#experience = null
    }
    /* getters/setters */
    get mbr_id(){
        return this.#avatar.mbr_id
    }
    get newGuid(){
        return this.#factory.newGuid
    }
    /* private functions */
}
/* module functions */
/* exports */
export default ExperienceAgent