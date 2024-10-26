/* module constants */
const mDefaultCollectionTypes = ['entry', 'experience', 'memory', 'story']
/* classes */
/**
 * @class - Bot
 * @private
 * @todo - are private vars for factory and llm necessary, or passable?
 */
class CollectionsAgent {
    #factory
    #llm
    constructor(llm, factory){
        this.#factory = factory
        this.#llm = llm
    }
}
/* module exports */
export default CollectionsAgent