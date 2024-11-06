// imports
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import EventEmitter from 'events'
import { Guid } from 'js-guid'
/* constants */
const mAiJsFunctions = await mParseFunctions()
const mEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mForbiddenCosmosFields = ['$', '_', ' ', '@', '#',]
const mGuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i	//	regex for GUID validation
const mOpenAIBotModel = process.env.OPENAI_MODEL_CORE_BOT
	?? 'gpt-4o'
/**
 * Globals class holds all of the sensitive data and functionality. It exists as a singleton.
 * @class
 * @extends EventEmitter
 * @todo - Since traced back to Maht Globals, this could be converted to the VM and hold that code
 */
class Globals extends EventEmitter {
	constructor() {
		super()
	}
	/* public functions */
	/**
	 * Chunk an array into smaller arrays and returns as an Array.
	 * @param {Array} array - Array to chunk
	 * @param {number} size - Size of chunks
	 * @returns {Array} - Array of chunked arrays
	 */
	chunkArray(array, size) {
		const result = []
		for(let i = 0; i < array.length; i += size){
			result.push(array.slice(i, i + size))
		}
		return result
	}
	/**
	 * Clears a const array with nod to garbage collection.
	 * @param {Array} a - the array to clear.
	 * @returns {void}
	 */
	clearArray(a){
		if(!Array.isArray(a))
			throw new TypeError('Expected an array to clear')
		for(let i = 0; i < a.length; i++){
			a[i] = null
		}
		a.length = 0
	}
	createDocumentName(mbr_id, id, type){
		if(!mbr_id || !id || !type)
			throw new Error('createDocumentName() expects `mbr_id`, `id`, and `type`')
		return `${ type.substring(0,32) }_${mbr_id}_${id}`
	}
	/**
	 * Create a member id from a system name and id: sysName|sysId.
	 * @param {string} sysName - System name to create the member id from.
	 * @param {Guid} sysId - System id to create the member id from, `Guid` required.
	 * @returns {string} - The member id created from the system name and id.
	 */
	createMbr_id(sysName, sysId){
		if(!sysName?.length || !this.isValidGuid(sysId))
			throw new Error('createMbr_id() expects params: sysName{string}, id{Guid}')
		const delimiter = '|' // currently used to separate system name and id in mbr_id
		const mbr_id = sysName
			.substring(0,64)
			.replace(/\s/g, '_').toLowerCase()
			+ delimiter
			+ sysId
		return mbr_id
	}
	/**
	 * Get a GPT File Search Tool structure.
	 * @param {string} vectorstoreId - the vector store id to search.
	 * @returns {object} - { file_search: { vector_store_ids: [vectorstoreId] } } - the GPT File Search Tool structure.
	 */
	getGPTFileSearchToolStructure(vectorstoreId){
		return {
			tools: [{ type: 'file_search' }],
			tool_resources: {
				file_search: {
					vector_store_ids: vectorstoreId ? [vectorstoreId] : []
				}
			},
		}
	}
	/**
	 * Get a GPT Javascript function by name.
	 * @param {string} name - the name of the function to retrieve.
	 * @returns {object} - {type: 'function', function, } - the function object.
	 */
	getGPTJavascriptFunction(name){
		if(!name?.length)
			throw new Error('getGPTJavascriptFunction() expects a function name as parameter')
		return {
			type: 'function',
			function: this.GPTJavascriptFunctions[name]
		}
	}
	getRegExp(text, isGlobal=false) {
		if (typeof text !== 'string' || !text.length)
			throw new Error('Expected a string')
		return new RegExp(text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), isGlobal ? 'g' : '')
	}
	isValidEmail(email){
		return typeof email === 'string' && mEmailRegex.test(email)
	}
	isValidGuid(text){
		return typeof text === 'string' && mGuidRegex.test(text)
	}
	isValidVersion(version) {
		const regex = /^\d+\.\d+\.\d+$/
		return typeof version === 'string' && regex.test(version)
	}
	/**
	 * Sanitize an object by removing forbidden Cosmos fields and undefined/null values.
	 * @param {object} object - Cosmos document to sanitize
	 * @returns {object} - Sanitized data object
	 */
	sanitize(object){
		if(!object || typeof object !== 'object')
			throw new Error('Parameter requires an object')
		const sanitizedData = Object.fromEntries(
			Object.entries(object)
				.filter(([key, value])=>
					!mForbiddenCosmosFields.some(char => key.startsWith(char)) &&
					value !== null &&
					value !== undefined
				)
		)
		return sanitizedData
	}
	sysId(_mbr_id){
		if(!typeof _mbr_id==='string' || !_mbr_id.length || !_mbr_id.includes('|'))
			throw new Error('expected MyLife member id string')
		return _mbr_id.split('|')[1]
	}
	sysName(_mbr_id){
		return _mbr_id.split('|')[0]
	}
	toString(_obj){
		return Object.entries(_obj).map(([k, v]) => `${k}: ${v}`).join(', ')
	}
	/*	getters/setters */
	get currentOpenAIBotModel(){
		return mOpenAIBotModel
	}
	get GPTJavascriptFunctions(){
		return mAiJsFunctions
	}
	get newGuid(){	//	this.newGuid
		return Guid.newGuid().toString()
	}
	get uploadPath(){
		return './.uploads/.tmp/'
	}
}
/* modular functions */
async function mParseFunctions(){
	const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
	const jsonFolderPath = path.join(__dirname, '..', 'json-schemas/openai/functions')
	const jsonObjects = {}
	const files = await fs.readdir(jsonFolderPath)
	for(const file of files){
		const filePath = path.join(jsonFolderPath, file)
		const stat = await fs.lstat(filePath)
		if(!stat.isFile() || path.extname(file) !== '.json')
			continue
		const data = await fs.readFile(filePath, 'utf8')
		const jsonObject = JSON.parse(data)
		const fileNameWithoutExtension = path.basename(file, path.extname(file))
		jsonObjects[fileNameWithoutExtension] = jsonObject
	}
	return jsonObjects
}
//	exports
export default Globals