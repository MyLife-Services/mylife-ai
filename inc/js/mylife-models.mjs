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
    #created=Date.now()
    #form
    #id
    #lastSaved
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
        item = this.#avatar.sanitize(item)
        const {
            being,
            complete,
            form,
            id=this.#avatar.newGuid,
            llm_id,
            mbr_id,
            summary='',
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
    async create(){
        await this.#avatar.itemCreate(this.item)
        this.#lastSaved = Date.now()
    }
    /**
     * Save the item to the datacore, and updates the next mechanical version.
     * @param {object} data - Data object describing fields to be saved (optional), defaults to allowable fields
     * @returns {Promise<void>}
     */
    async save(data=this.item){
        await this.#avatar.itemUpdate(data)
        this.updateVersion()
        this.#lastSaved = Date.now()
    }
    /**
     * Update the item with valid new data.
     * @param {object} data - Data object to update instance
     * @param {Boolean} save - Save the item after update, default: `true`
     * @returns {Promise<void>}
     */
    async update(data, save=true){
        delete data.itemId
        const immutableFields = ['being', 'id', 'llm_id', 'mbr_id', 'type']
        this.#avatar.populateObject(this, data, immutableFields)
        this.updateVersion()
        if(save)
            await this.save(data)
    }
    /**
     * Update the item version.
     * @param {boolean} system - Update the system version (default: true)
     * @returns {void}
     */
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
        if(typeof value==='string' && value?.length){
            this.#summary = value
            this.updateVersion()
        }
    }
    /**
     * Gets time since last object save in milliseconds.
     * @getter
     * @returns {number} - Time since last save
     */
    get unsavedDuration(){
        return Date.now()-(this.#lastSaved ?? this.#created)
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
        _item.type = 'entry'
        super(_item, avatar, llmServices)
        this.#content = content
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