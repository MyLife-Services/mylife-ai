/* imports */
import { EventEmitter } from 'events'
/* module constants */
const mAvailableForms = ['entry', 'memory'],
    mBeing = `story`,
    mVersion = 1.0
/**
 * @class - Item
 * @extends EventEmitter
 * @description An `Item` is the root class for `story` beings in the datacore. `Story` currently is extended by `Memory` and `Entry` classes. These classes by design have access to private intelligence based upon incoming parameters or the initial generating request bot.
 */
class Item extends EventEmitter {
    #additionalProperties
    #availableForms = mAvailableForms
    #avatar
    #being=mBeing
    #complete=false
    #form
    #id
    #llm_id
    #llmServices
    #mbr_id
    #summary
    #type
    #version
    /**
     * @constructor
     * @param {object} item - Data object (optional)
     * @param {Avatar} avatar - The Member Avatar instance
     * @param {LLMServices} llmServices - The LLM services object
     */
    constructor(item, avatar, llmServices){
        if(!avatar || !llmServices)
            throw new Error('Avatar and LLM services required')
        if(avatar.isMyLife)
            throw new Error('MyLife cannot create stories')
        if(!item?.summary?.length)
            throw new Error('Item requires a summary')
        super()
        this.#avatar = avatar
        this.#llmServices = llmServices
        const {
            being,
            complete,
            form,
            id=this.#avatar.newGuid,
            llm_id,
            mbr_id,
            summary,
            type,
            version=mVersion,
            ...additionalProperties
        } = item
        this.#additionalProperties = additionalProperties
        this.#form = form
        this.#id = id
        this.#llm_id = llm_id
        this.#mbr_id = avatar.mbr_id
        this.#summary = summary
        this.#type = type
        this.#version = version
        this.#avatar.populateObject(this, this.#additionalProperties)
    }
    /* public functions */
    /**
     * Save the item to the datacore.
     * @returns {Promise<void>}
     */
    async save(){
        console.log('Item.save()', this.item)
        await this.#avatar.itemSave(this.item)
        this.updateVersion()
    }
    updateVersion(system=true){
        if(system)
            this.#version += 0.1
        else
            this.#version = Math.floor(this.#version) + 1
    }
    /* getters/setters */
    get being(){
        return this.#being
    }
    get complete(){
        return this.#complete
    }
    get form(){
        return this.#form
    }
    get id(){
        return this.#id
    }
    get itemCore(){
        return {
            being: this.being,
            complete: this.complete,
            form: this.form,
            id: this.id,
            llm_id: this.llm_id,
            mbr_id: this.mbr_id,
            summary: this.summary,
            type: this.type,
            version: this.version,
        }
    }
    get item(){
        return {
            ...this.#additionalProperties,
            ...this.itemCore,
        }
    }
    get llm_id(){
        return this.#llm_id
    }
    get mbr_id(){
        return this.#mbr_id
    }
    get summary(){
        return this.#summary
    }
    set summary(value){
        if(!value?.length || typeof value !== 'string')
            throw new Error('Summary string required')
        this.#summary = value
    }
    get type(){
        return this.#type
    }
    set type(value){
        if(this.#availableForms.indexOf(value)!==-1)
            this.#type = value
    }
    get version(){
        return this.#version
    }
}
class Entry extends Item {
    #content
    constructor(item, avatar, llmServices){
        const { content, ..._item } = item
        this.#content = content
        _item.type = 'entry'
        super(_item, avatar, llmServices)
    }
    /* getters/setters */
    get itemCore(){
        return {
            ...super.itemCore,
            content: this.#content,
        }
    }
    get content(){
        return this.#content
    }
}
class Memory extends Item {
    constructor(item, avatar, llmServices){
        item.type = 'memory'
        super(item, avatar, llmServices)
    }
}
/* module functions */
/* exports */
export {
    Entry,
	Memory,
}