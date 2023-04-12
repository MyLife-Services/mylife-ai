//	ai - create sub-file to include
import { OpenAIApi, Configuration } from 'openai'
import fs from 'fs'
import { parseXml } from './inc/js/private.js'
// instance OpenAIApi config
const config = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organizationId: process.env.OPENAI_ORG_KEY,
	timeoutMs: process.env.OPENAI_TIMEOUT,
	basePath: process.env.OPENAI_BASE_URL,
})
const openai = new OpenAIApi(config)
//	PUBLIC functions
async function processRequest(_question,_agent='ai'){
	//	pre-vet, trim, approve(?) input
	
	// assign histories and roles
	//	assignHistory(_question)
	const aQuestion = assignRoles(_agent)	//	returns array of objects
	aQuestion.push(assignQuestion(_question))
	console.log(aQuestion)
	const _response = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: aQuestion,
//		git: { repo: 'https://github.com/MyLife-Services/mylife-maht' },
	})
		.then()
		.catch(err=>{
			console.log(err)
//			throw(err)
		})
	//	response insertion/alteration points for approval, validation, storage, pruning
	challengeResponse(_response) //	insertion point: human reviewable
	return formatResponse(_response)
}
//	PRIVATE functions
function assignHistory(_question){
	//	assignSessionHistory
	//	assignPersonalHistory
}
function assignQuestion(_question){
	return {
			role: 'user',
			content: _question
		}
}
function assignRoles(_agent){
	switch(_agent){
		case 'board':
			const xml = fs.readFileSync('./privacy/data.xml', 'utf-8')
			const oMember = parseXml(xml)	//	consider it a class as defined in the xml file, xml being nod to Ben Tremblay
			return getMember(oMember)
		case 'ai':
			return getAI()
		default:
			throw('agent not recognized')
	}
}
function challengeResponse(){

}
function formatResponse(_response){
	//	insert routines for emphasis
	_response=_response.data.choices[0].message.content
	_response=_response.replace(/(\s|^)mylife(\s|$)/gi, "$1<em>MyLife</em>$2")
	return _response
}
function getMember(oMember){
	oMember = oMember.privacy.member
	return [
		{
			role: 'system',
			content: `I am assistant to: ${oMember.contact.name}. ${oMember.personality.bio}`
		},
		{
			role: "user",
			content: "What are Erik's interests?"
		},
		{
			role: "assistant",
			content: oMember.personality.interests.toString()
		},
		{
			role: "user",
			content: "What is MyLife?"
		},
		{
			role: "assistant",
			content: "MyLife, founded in 2021, is a nonprofit member-based organization aiming to protect and preserve the authentic and genuine 21st-century human experience. It offers a free, secure, and equitable network for personal archives and narrative legacies, helping individuals define their Digital Selves."
		},
	]
}

export default processRequest