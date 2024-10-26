/* variables */
const { MYLIFE_ALLOW_INTELLIGENT_QUESTIONS } = process.env
const allowLLMQuestions = JSON.parse(MYLIFE_ALLOW_INTELLIGENT_QUESTIONS ?? 'false')
/* contribution module functions */
/**
 * Gets questions from Cosmos, but could request from openAI.
 * @param {Contribution} _contribution Contribution object
 * @param {OpenAI} _openai OpenAI object
 * @returns {string}
 */
async function mGetQuestions(_contribution, _openai){
    /*  get questions from openAI
        -   if no content, generate questions for description
        -   if content, generate questions with intent to nuance content
    */
   const _contribution_request = _contribution.request
    if(!_contribution_request?.content){ //  null nodes render to false
        const _response = await _contribution.factory.getContributionQuestions(
            _contribution_request.impersonation,
            _contribution_request.category,
        )
        return _response
    }
    if(!allowLLMQuestions)
        return ['What is the meaning of life?']
/* @todo: refactor for gpt's
    const _response = await _evoAgent.openai.completions.create({
        model: 'gpt-4o',
        prompt: 'give a list of 3 questions (markdown bullets) used to ' + (
            (!this.request.content)
            ?   `get more information about a ${this.request.impersonation} regarding its ${this.request.category}`
            :   `improve the following description of a ${this.request.impersonation} regarding its ${this.request.category}: "${this.request.content}"`
        ),
        temperature: 0.76,
        max_tokens: 700,
        top_p: 0.71,
        best_of: 5,
        frequency_penalty: 0.87,
        presence_penalty: 0.54,
    })
    //  parse response
    return _response.choices[0].text
        .split('\n')    // Split into lines
        .map(line => line.trim())   // Trim each line
        .filter(line => line.startsWith('-'))   // Filter lines that start with '-'
        .map(line => line.substring(1).trim())  // Remove the '-' and extra space
*/
}
/**
 * Updates contribution object with incoming contribution data.
 * @module
 * @param {Contribution} _contribution - Contribution object
 * @param {object} _obj - Contribution data { category, contributionId, content??question??message }
 * @returns {void}
 */
function mUpdateContribution(_contribution, _obj){
    if(_obj?.question ?? _obj?.content ?? _obj?.message){
        _contribution.responses.unshift( // todo: ensure incoming has _only_ `content`
            _obj.question??
            _obj.content??
            _obj.message
        )
    }
    mEvaluateStatus(_contribution) // evaluates readiness for next stage of Contribution
}
/* contribution "private" module functions [unexported] */
/**
 * Evaluates Contribution and may update `status` property.
 * @module
 * @param {Contribution} _contribution - Contribution object
 * @returns {void}
 */
function mEvaluateStatus(_contribution){
    // assess `status`
    // statuses=["new", "pending", "prepared", "requested", "submitted", "accepted", "rejected"],
    switch(true){
        case(['submitted', 'accepted', 'rejected'].includes(_contribution.status)):
            //  intentionally empty, different process manages, no change
            break
        case (_contribution.responses.length === 1): // **note** `.question` = responses[0]
            _contribution.status = 'pending'
            _contribution.emit('on-contribution-prepared', _contribution.id)
            break
        case(_contribution.responses.length > 1): // subsequent objects, by logic = response included
            _contribution.status = 'requested'
            break
        default:
            _contribution.status = 'pending' // no emission
            break
    }
}
/* exports */
export {
    mGetQuestions,
    mUpdateContribution,
}