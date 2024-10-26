/* modular public functions */
/**
 * Consumes a conversation object and uses supplied factory to (create/)save it to MyLife CosmosDB. Each session conversation is saved as a separate document, and a given thread may span many conversations, so cross-checking by thread_id will be required when rounding up and consolidating summaries for older coversations.
 * @param {AgentFactory} factory - Factory instance
 * @param {Conversation} Conversation - Conversation instance
 * @returns {Promise<void>}
 */
async function mSaveConversation(Conversation, factory){
    const {
        being,
        bot_id,
        form,
        id,
        isSaved=false,
        name,
        thread,
        type,
    } = Conversation
    let { messages, } = Conversation
    messages = messages
        .map(_msg=>_msg.micro)
    if(!isSaved){
        const _newConversation = {
            being,
            bot_id,
            form,
            id,
            messages,
            name,
            thread,
            type,
        }
        const newConversation = await factory.dataservices.pushItem(_newConversation)
        return !!newConversation
    }
    const updatedConversation = await factory.dataservices.patch(
        id,
        { messages, }
    )
    return !!updatedConversation
}
/* exports */
/* modular private functions */
export {
    mSaveConversation,
}