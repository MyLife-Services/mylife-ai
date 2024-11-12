import { EventEmitter } from 'events'
import chalk from 'chalk'
class MylifeMemberSession extends EventEmitter {
	#alertsShown = [] // array of alert_id's shown to member in this session
	#autoplayed = false // flag for autoplayed experience, one per session
	#consents = []	//	consents are stored in the session
	#experienceLocked = false
	#experiences = [] // holds id for experiences conducted in this session
	#factory
	#mbr_id = false
	#Member
	name
	#sessionLocked = true // locked by default
	constructor(factory){
		super()
		this.#factory = factory
		this.#mbr_id = this.isMyLife ? this.factory.mbr_id : false
	}
	/**
	 * Initializes the member session. If `isMyLife`, then session requires chat thread unique to visitor; session has singleton System Avatar who maintains all running Conversations.
	 * @param {String} mbr_id - Member id to initialize session
	 * @returns {Promise<MylifeMemberSession>} - Member session instance
	 */
	async init(mbr_id=this.mbr_id){
		if(!this.locked && this.mbr_id && this.mbr_id!==mbr_id){ // unlocked, initialize member session
			this.#mbr_id = mbr_id
			await this.#factory.init(this.mbr_id) // needs only `init()` with different `mbr_id` to reset
			this.#Member = await this.factory.getMyLifeMember()
			this.#autoplayed = false
			delete this.Conversation
			delete this.thread_id
			console.log(chalk.bgBlue('created-member:'), chalk.bgRedBright(this.#Member.memberName))
		}
		return this
	}
	async alert(_alert_id){
		return this.factory.getAlert(_alert_id)
	}
	async alerts(_type){
		let currentAlerts = this.factory.alerts
		// remove alerts already shown to member in this session
		currentAlerts = currentAlerts
			.filter(_alert=>{
				return !this.#alertsShown.includes(_alert.id)
			})
		currentAlerts.forEach(_alert=>{
			this.#alertsShown.push(_alert.id)
		})
		return currentAlerts
	}
	/**
	 * Conducts an experience for the member session. If the experience is not already in progress, it will be started. If the experience is in progress, it will be played. If the experience ends, it will be ended. The experience will be returned to the member session, and the session will be unlocked for further experiences, and be the prime tally-keeper (understandably) of what member has undergone.
	 * @todo - send events in initial start package, currently frontend has to ask twice on NON-autoplay entities, which will be vast majority
	 * @param {Guid} experienceId - Experience id to conduct.
	 * @param {any} memberInput - Input from member, presumed to be object, but should be courteous, especially regarding `eperience` conduct.
	 * @returns {Promise<object>} - Experience frontend shorthand: { autoplay: guid ?? false, events: [], location: {string}, title: {string} }
	 */
	async experience(experienceId, memberInput){
		const { avatar } = this
		let events = []
		/* check locks and set lock status */
		this.#experienceLocked = true
		try{ // requires try, as locks would otherwise not release on unidentified errors
			if(!avatar.isInExperience){
				// @stub - check that events are being sent
				await avatar.experienceStart(experienceId)
			} else {
				const eventSequence = await avatar.experiencePlay(experienceId, memberInput)
				events = eventSequence
			} 
		} catch (error){
			const { experience } = avatar
			if(experience){ // embed error in experience
				experience.errors = experience.errors ?? []
				experience.errors.push(error)
			}
		}
		const { experience } = avatar
		const { autoplay, location, title, } = experience
		const frontendExperience = {
			autoplay,
			events,
			location,
			title,
		}
		this.#experienceLocked = false
		if(events.find(event=>{ return event.action==='end' && event.type==='experience' }))
			this.experienceEnd(experienceId)
		return frontendExperience
	}
	/**
	 * Ends the experience for the member session. If the experience is in progress, it will be ended. Compares experienceId as handshake confirmation.
	 * @param {Guid} experienceId - Experience id to end.
	 * @returns {Promise<boolean>} - Experience end status.
	 */
	async experienceEnd(experienceId){
		const { avatar } = this
		let success = false
		this.#experienceLocked = true
		try{
			await avatar.experienceEnd(experienceId)
			success = true
		} catch (error){ /* avatar throws errors when antagonized */
			const { experience } = avatar
			console.log(chalk.redBright('experienceEnd() error'), error, avatar.experience)
			if(experience){ // embed error in experience
				experience.errors = experience.errors ?? []
				experience.errors.push(error)
			}
		}
		this.#experienceLocked = false
		return success
	}
	/**
	 * Gets experiences for the member session. Identifies if autoplay is required, and if so, begins avatar experience via this.#Member. Ergo, Session can request avatar directly from Member, which was generated on `.init()`.
	 * @todo - get and compare list of lived-experiences
	 * @param {boolean} includeLived - Include lived experiences in the list.
	 * @returns {Promise<object>} - Experiences shorthand: { autoplay: guid??false, events: [], experiences: [] }
	 * @property {Guid} autoplay - Autoplay experience id.
	 * @property {Object[]} events - Array of events.
	 * @property {Object[]} experiences - Array of experiences.
	 */
	async experiences(includeLived=false){
		if(this.sessionLocked)
			throw new Error('Session locked; `experience`(s) list(s) does not exist for guests.')
		const { avatar } = this.#Member
		const experiences = await avatar.experiences(includeLived)
		let autoplay = experiences.find(experience=>experience.autoplay)?.id
			?? false
		/* trigger auto-play from session */
		if(!this.#autoplayed && this.globals.isValidGuid(autoplay)){
            await avatar.experienceStart(autoplay)
			this.#autoplayed = true
        }
		else
			autoplay = false
		return { autoplay, experiences, mbr_id: this.mbr_id }
	}
	//	consent functionality
	async requestConsent(ctx){
		//	validate request; switch true may be required
		if(!mValidCtxObject(ctx))
			return false	//	invalid ctx object, consent request fails
		//	check-01: url ends in valid guid /:_id
		const _object_id = ctx.request.header?.referer?.split('/').pop()
		//	not guid, not consent request, no blocking
		if(!this.globals.isValidGuid(_object_id)) return true
		//	ultimately, applying a disposable agent of intelligence to consent request might be the answer
		let _consent = this.consents
			.filter(_=>{ return _.id==_object_id })
			.pop()
		if(!_consent){
			//	create and notify session
			_consent = await this.factory.getConsent({
				id: _object_id,
				mbr_id: this.mbr_id,
				being: 'consent',
				context: `This consent object was created by MyLife Session [${this.mbr_id}] to manage access to asset [${_object_id}] of owner [${this.mbr_id}].`,
				purpose: `To manage requested access to the underlying avatar or object according to the wills and expressions of the member identified by their mbr_id: ${this.mbr_id}.`,
			})
			this.consents.unshift(_consent)
		}
		return _consent.allow()	//	might benefit from putting consent into openai assistant metadata with suggestion to adhere when creating content
		if(!ctx.request.body) return	//	nothing to do
		//	based on incoming request, parse out consent id and request
		return this.factory.requestConsent(_consent_id,_request)
		
		if(!this?.ctx?.session?.MemberSession?.consents) return	//	pre-natal instance of MyLife?
		//	otherwise, should be able to construe
		_consent = (_consent_id)
			?	{}	//	retrieve from Cosmos
			:	new (this.schemas.consent)(_request, this)	//	generate new consent
		//	manipulate session through ctx (although won't exist in initial test case)
		await (this.ctx.session.MemberSession.consents = _consent)	//	will add consent to session list
		return _consent
	}
	/* getters and setters */
	get avatar(){
		return this.#Member.avatar
	}
	/**
	 * @param {boolean} outcome - The challenge outcome; `true` was successful
	 */
	set challengeOutcome(outcome){
		if(outcome)
			this.#sessionLocked = false
	}
	get consent(){
		return this.factory.consent	//	**caution**: returns <<PROMISE>>
	}
	set consent(_consent){
		this.#consents.unshift(_consent)
	}
	get consents(){
		return this.#consents
	}
	get core(){
		return this.factory.core
	}
	get experiencesLived(){
		if(this.sessionLocked)
			throw new Error('Session locked; `experience`(s) list(s) does not exist for guests.')
		const { avatar } = this.#Member
		return avatar.experiencesLived
	}
	get factory(){
		return this.#factory
	}
	get globals(){
		return this.factory.globals
	}
	get isInitialized(){
		return ( this.mbr_id!==false )
	}
	get isMyLife(){
		return this.factory.isMyLife
	}
	get locked(){
		return this.sessionLocked
	}
	get mbr_id(){
		return this.#mbr_id
	}
	get mbr_id_id(){
		return this.globals.sysId( this.mbr_id )
	}
	get member(){ // @todo - deprecate and funnel through any requests
		return this.#Member
	}
	get sessionLocked(){
		return this.#sessionLocked
	}
	get subtitle(){
		return this.#Member?.agentName
	}
}
function mValidCtxObject(_ctx){
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
export default MylifeMemberSession