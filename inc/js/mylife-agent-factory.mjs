//	imports
import OpenAI from 'openai'
import { promises as fs } from 'fs'
import EventEmitter from 'events'
import vm from 'vm'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
import Globals from './globals.mjs'
import Dataservices from './mylife-data-service.js'
import { Member, MyLife } from './core.mjs'
import { extendClass_avatar, extendClass_consent, extendClass_message } from './factory-class-extenders/class-extenders.mjs'	//	do not remove, although they are not directly referenced, they are called by eval in configureSchemaPrototypes()
import Menu from './menu.js'
import MylifeMemberSession from './session.js'
import { _ } from 'ajv'
// modular constants
// global object keys to exclude from class creations [apparently fastest way in js to lookup items, as they are hash tables]
const excludeProperties = {
	$schema: true,
	$id: true,
	$defs: true,
	$comment: true,
	definitions: true,
	name: true
}
const path = './inc/json-schemas'
const vmClassGenerator = vm.createContext({
	exports: {},
	console: console,
	import: async _module => await import(_module),
//	utils: utils,
//	sharedData: sharedData,
//	customModule: customModule,
//	eventEmitter: EventEmitter,
})
const dataservicesId = process.env.MYLIFE_SERVER_MBR_ID
const oDataservices = await new Dataservices(dataservicesId).init()
const schemas = {
	...await loadSchemas(),
	dataservices: Dataservices,
	menu: Menu,
	member: Member,
	server: MyLife,
	session: MylifeMemberSession
}
const _Globals = new Globals()
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
// config: add functionality to known prototypes
configureSchemaPrototypes()
// modular variables
let oServer
//	logging/reporting
//	console.log('AgentFactory loaded; schemas:', schemas)
// modular classes
class AgentFactory extends EventEmitter{
	#ctx	//	allows perennial access to ctx scope with mutability
	#dataservices
	#mbr_id
	constructor(_mbr_id=dataservicesId, ctx){
		super()
		//	if incoming member id is not same as id on oDataservices, then ass new class-private dataservice
		this.#mbr_id = _mbr_id
		this.#ctx = ctx
	}
	//	public functions
	async init(_mbr_id){
		if(_mbr_id) this.#mbr_id = _mbr_id
		this.#dataservices = 
			(this.mbr_id!==oDataservices.mbr_id)
			?	await new Dataservices(this.mbr_id).init()
			:	oDataservices
		if(!oServer) oServer = await new MyLife(this).init()
		return this
	}
	async getAvatar(){
		//	get avatar template for metadata from cosmos
		const _avatarProperties = await this.dataservices.getAgent(this.globals.extractId(this.mbr_id))
		//	activate (created inside if necessary) avatar
		const _avatar = new (this.schemas.avatar)(_avatarProperties, this)
		//	update conversation
		if(this.ctx?.session?.MemberSession?.conversation){
			console.log('you betcha')
		}
		if(!_avatar.assistant) await _avatar.getAssistant(this.dataservices)
		return _avatar
	}
	async getConsent(_consent_id,_request){
		const _consent = (_consent_id)
			?	{}	//	retrieve from Cosmos
			:	new (this.schemas.consent)(_request, this)	//	generate new consent
		console.log('_consent', _consent)
	}
	async getMyLifeMember(){
		const _r =  await new (schemas.member)(this)
			.init()
		return _r
	}
	async getMyLifeSession(_challengeFunction){
		//	default is session based around default dataservices [Maht entertains guests]
		return await new (this.schemas.session)(dataservicesId,_Globals,_challengeFunction).init()
	}
	async getThread(){
		return await openai.beta.threads.create()
	}
	//	getters/setters
	get consent(){
		return
	}
	get conversation(){
		return this.schemas.conversation
	}
	get core(){
		const _excludeProperties = { '_none':true }
		let _core = Object.entries(this.#dataservices.core)	//	array of arrays
			.filter((_prop)=>{	//	filter out excluded properties
				const _charExlusions = ['_','@','$','%','!','*',' ']
				return !(
						(_prop[0] in _excludeProperties)
					||	!(_charExlusions.indexOf(_prop[0].charAt()))
				)
				})
			.map(_prop=>{	//	map to object
				return { [_prop[0]]:_prop[1] }
			})
		_core = Object.assign({},..._core)	//	merge to single object
		
		return _core
	}
	get ctx(){
		return this.#ctx
	}
	set ctx(_ctx){
		if(!validCtxObject(_ctx)) throw new Error('invalid ctx object')
		this.#ctx = _ctx
	}
	get dataservices(){
		return this.#dataservices
	}
	get factory(){	//	get self
		return this
	}
	get file(){
		return this.schemas.file
	}
	get globals(){
		return _Globals
	}
	get mbr_id(){
		return this.#mbr_id
	}
	get message(){
		return this.schemas.message
	}
	get organization(){
		return organization
	}
	get organization(){
		return oServer
	}
	get schema(){	//	proxy for schemas
		return this.schemas
	}
	get schemaList(){	//	proxy for schemas
		return Object.keys(this.schemas)
	}
	get schemas(){
		return schemas
	}
	get session(){
		return this.schemas.session
	}
	get urlEmbeddingServer(){
		return process.env.MYLIFE_EMBEDDING_SERVER_URL+':'+process.env.MYLIFE_EMBEDDING_SERVER_PORT
	}
}
// private modular functions
function assignClassPropertyValues(_propertyDefinition,_schema){	//	need schema in case of $def
	switch (true) {
		case _propertyDefinition?.const!==undefined:	//	constants
			return `'${_propertyDefinition.const}'`
		case _propertyDefinition?.default!==undefined:	//	defaults: bypass logic
			if(Array.isArray(_propertyDefinition.default)){
				return '[]'
			}
			return `'${_propertyDefinition.default}'`
		default:
			//	presumption: _propertyDefinition.type is not array [though can be]
			switch (_propertyDefinition?.type) {
				case 'array':
					return '[]'
				case 'boolean':
					return false
				case 'integer':
				case 'number':
					return 0
				case 'string':
					switch (_propertyDefinition?.format) {
						case 'date':
						case 'date-time':
							return `'${new Date().toDateString()}'`
						case 'uuid':
							return `'${Guid.newGuid().toString()}'`
						case 'email':
						case 'uri':
						default:
							return null
					}
				case undefined:
				default:
					return null
			}
	}
}
function compileClass(_className, classCode) {
	// Create a global vm context and run the class code in it
	vm.runInContext(classCode, vmClassGenerator)
	// Return the compiled class
	return vmClassGenerator.exports[_className]
}
async function configureSchemaPrototypes(){	//	add required functionality as decorated extension class
	for(const _class in schemas){
		//	global injections; maintained _outside_ of eval class
		Object.assign(
			schemas[_class].prototype,
			{ sanitizeValue: sanitizeValue },
		)
		try{
			eval(`extendClass_${_class}`)	//	see if extension function exists
			console.log(`extension function found for ${_class}`)
		} catch(err){
			continue
		}
		//	add extension decorations
		const _references = { openai: openai, factory: this }
		schemas[_class] = eval(`extendClass_${_class}(schemas[_class],_references)`)
	}
}
function generateClassCode(_className,_properties,_schema){
	//	delete known excluded _properties in source
	for(const _prop in _properties){
		if(_prop in excludeProperties){ delete _properties[_prop] }
	}
	// Generate class
	let classCode = `
// Code will run in vm and pass back class
class ${_className} {
// private properties
#excludeConstructors = ${ '['+Object.keys(excludeProperties).map(key => "'" + key + "'").join(',')+']' }
#name
`
	for (const _prop in _properties) {	//	assign default values as animated from schema
		const _value = sanitizeValue(assignClassPropertyValues(_properties[_prop],_schema))
		//	this is the value in error that needs sanitizing
		classCode += `	#${(_value)?`${_prop} = ${_value}`:_prop}\n`
	}
	classCode += `
// class constructor
constructor(obj){
	try{
		for(const _key in obj){
			//	exclude known private properties and db properties beginning with '_'
			if(this.#excludeConstructors.filter(_prop=>{ return (_prop==_key || _key.charAt(0)=='_')}).length) { continue }
			try{
				eval(\`this.\#\${_key}=obj[_key]\`)
			} catch(err){
				eval(\`this.\${_key}=obj[_key]\`)
				console.log(\`could not privatize \${_key}, public node created\`)
			}
		}
		console.log('vm ${ _className } class constructed')
	} catch(err) {
		console.log(\`FATAL ERROR CREATING \${obj.being}\`, err)
		rethrow
	}
}
// if id changes are necessary, then use set .id() to trigger the change
// getters/setters for private vars`
	for (const _prop in _properties) {
		const _type = _properties[_prop].type
		// generate getters/setters
		classCode += `
get ${_prop}() {
	return this.#${_prop}
}
set ${_prop}(_value) {	// setter with type validation
	if (typeof _value !== '${_type}') {
		if(!('${_type}'==='array' && Array.isArray(_value))){
			throw new Error('Invalid type for property ${_prop}: expected ${_type}')
		}
	}
	if( this?.#${_prop} ) this.#${_prop} = _value
	else this.${_prop} = _value
}`
	}
	//	functions
	//	inspect: returns a object representation of available private properties
	classCode += `	// public functions
inspect(_all=false){
	let _this = (_all)?{`
	for (const _prop in _properties) {
		classCode += `			${_prop}: this.#${_prop},\n`
	}
	classCode += `		}:{}
	return {...this,..._this}
}
}
exports.${_className} = ${_className}`
	return classCode
}
function generateClassFromSchema(_schema) {
	//	get core class
	const _className = _schema.name
	const _properties = _schema.properties	//	wouldn't need sanitization, as refers to keys
	const _classCode = generateClassCode(_className,_properties,_schema)
	//	compile class and return
	return compileClass(_className,_classCode)
}
async function loadSchemas() {
	try{
		let _filesArray = await (fs.readdir(path))
		_filesArray = _filesArray.filter(_filename => _filename.split('.')[1] === 'json')
		const schemasArray = await Promise.all(
			_filesArray.map(
				async _filename => {
					const _file = await fs.readFile(`${path}/${_filename}`, 'utf8')
					const _fileContent = JSON.parse(_file)
					const _classArray = [{ [_filename.split('.')[0]]: generateClassFromSchema(_fileContent) }]
					if (_fileContent.$defs) {
						for (const _schema in _fileContent.$defs) {
							_classArray.push({ [_schema]: generateClassFromSchema(_fileContent.$defs[_schema]) })
						}
					}
					return _classArray
				}
			)
		)
		return schemasArray.reduce((acc, array) => Object.assign(acc, ...array), {})
	} catch(err){
		console.log(err)
		if(schemasArray) console.log(schemasArray)
	}
}
function sanitizeValue(_value) {
    if (typeof _value !== 'string') return _value

    let startsWithQuote = _value.startsWith("'") || _value.startsWith('"') || _value.startsWith('`')
    let endsWithQuote = _value.endsWith("'") || _value.endsWith('"') || _value.endsWith('`')
    let wasTrimmed = startsWithQuote && endsWithQuote && _value[0] === _value[_value.length - 1]

    let trimmedStr = wasTrimmed ? _value.substring(1, _value.length - 1) : _value
    trimmedStr = trimmedStr.replace(/(?<!\\)[`\\$'"]/g, "\\$&")

    return wasTrimmed ? _value[0] + trimmedStr + _value[0] : trimmedStr
}
function validCtxObject(_ctx){
	//	validate ctx object
	return	(
			_ctx
		&&	typeof _ctx === 'object'
		&&	'request' in _ctx 
		&&	'response' in _ctx
		&&	'session' in _ctx
		&&	'state' in _ctx
	)
}
//	exports
export default AgentFactory