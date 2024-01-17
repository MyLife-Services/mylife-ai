document.addEventListener('DOMContentLoaded', function() {
    fetchBots()
})
document.querySelectorAll('.bot-container').forEach(container => {
    container.addEventListener('click', function(_event) {
        _event.stopPropagation();
        // First, close any currently open containers and rotate their dropdowns back
        // console.log('bot-container::onClick', _event.target)
        const _itemIdSnippet = _event.target.id.split('-').pop()
        switch(_itemIdSnippet){
            case 'create':
                // validate required fields
                if(!this.getAttribute('data-mbr_id')?.length){
                    alert('Please login to create a bot.')
                    return
                }
                if(!this.getAttribute('data-dob')?.length){
                    alert('Birthdate is required to calibrate your biographer.')
                    return
                }
                if(!this.getAttribute('data-bot_name')?.length){
                    this.setAttribute('data-bot_name', `${g_dash(this.getAttribute('data-mbr_handle'))}-${this.getAttribute('data-type')}`)
                }
                // mutate bot object
                const _bot = {
                    bot_id: this.getAttribute('data-bot_id'),
                    bot_name: this.getAttribute('data-bot_name'),
                    dob: this.getAttribute('data-dob'),
                    id: this.getAttribute('data-id'),
                    mbr_id: this.getAttribute('data-mbr_id'),
                    object_id: this.getAttribute('data-object_id'),
                    provider: this.getAttribute('data-provider'),
                    purpose: this.getAttribute('data-purpose'),
                    type: this.getAttribute('data-type'),
                }
                switch(_bot.type){
                    case 'personal-biographer':
                        _bot.dob = this.getAttribute('data-dob')
                        _bot.interests = this.getAttribute('data-interests')
                        const _n = parseInt(this.getAttribute('data-narrative'), 10)
                        _bot.narrative = isNaN(_n) ? 50 : Math.min(100, Math.max(1, _n))
                        const _pv = parseInt(this.getAttribute('data-privacy'), 10)
                        _bot.privacy = isNaN(_pv) ? 50 : Math.min(100, Math.max(0, _pv))
                        break
                    default:
                        break
                }
                // post to endpoint
                const _returnBot = setBot(_bot)
                /* check for success and activate */
                return
            case 'name':
            case 'ticker':
                // start/stop ticker
                // @todo: double-click to edit in place
                const _span = this.querySelector('span')
                    ? this.querySelector('span')
                    : _event.target;
                _span.classList.toggle('no-animation');
                return
            case 'status':
            case 'type':
            case 'dropdown':
                document.querySelectorAll('.bot-container').forEach(otherContainer => {
                    if (otherContainer !== this) {
                        // Close the bot options
                        var otherContent = otherContainer.querySelector('.bot-options');
                        if (otherContent) {
                            otherContent.classList.remove('open');
                        }
                        // Rotate back the dropdowns
                        var otherDropdown = otherContainer.querySelector('.bot-options-dropdown');
                        if (otherDropdown) {
                            otherDropdown.classList.remove('open');
                        }
                    }
                });
                // Then, toggle the visibility of the clicked container's content
                var content = this.querySelector('.bot-options');
                if (content) {
                    content.classList.toggle('open');
                }
                // Also toggle the dropdown rotation
                var dropdown = this.querySelector('.bot-options-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('open');
                }
                return
            default:
                break
        }
    });
});
async function fetchBots(){
    try {
        const _url = window.location.origin + '/members/bots';
        const response = await fetch(_url); // Replace with your actual endpoint
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const bots = await response.json();
        // Process and display the bots here
        updateBotContainers(bots);
    } catch (error) {
        console.log('Error fetching bots:', error);
    }
}
function getBotStatus(_bot, _botIcon){
    switch (true) {
        case (_bot?.thread_id?.length>0 || false): // activated
            _botIcon.classList.add('active');
            _botIcon.classList.remove('inactive');
            return 'active'
        case ( _bot?.bot_id?.length>0 || false): // unactivated
            _botIcon.classList.add('inactive');
            _botIcon.classList.remove('active');
            return 'inactive'
        default:
            _botIcon.classList.remove('active', 'inactive');
            return 'none'
    }
}
async function setBot(_bot){
    try {
        const _url = window.location.origin + '/members/bots/' + _bot.id
        const response = await fetch(_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(_bot)
        })
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // Process response here if needed
        const responseData = await response.json();
        // Handle successful response data
        console.log('Success:', responseData);
    } catch (error) {
        console.log('Error posting bot data:', error);
    }
    return
}
function updateBotContainers(_bots){
	_bots.forEach(_bot => {
        console.log('bot-initialization', _bot)
        const _botContainer = document.getElementById(_bot.type)
        if (_botContainer) {
            /* attributes */
            _botContainer.setAttribute('data-bot_id', _bot?.bot_id??'')
            _botContainer.setAttribute('data-bot_name', _bot?.bot_name??`${g_dash((_bot?.object_id??_bot.mbr_id).split('|')[0])}-${_type}`)
            _botContainer.setAttribute('data-id', _bot?.id??'')
            // _botContainer.setAttribute('data-instructions', _bot?.instructions??'')
            _botContainer.setAttribute('data-mbr_id', _bot?.mbr_id??'')
            _botContainer.setAttribute('data-mbr_handle', g_handle( _botContainer.getAttribute('data-mbr_id')))
            _botContainer.setAttribute('data-object_id', g_id(_bot?.object_id??''))
            _botContainer.setAttribute('data-provider', _bot?.provider??'')
            _botContainer.setAttribute('data-purpose', _bot?.purpose??'')
            _botContainer.setAttribute('data-thread_id', _bot?.thread_id??'')
            _botContainer.setAttribute('data-type', _bot?.type??'')
            /* constants */
            const _type = _botContainer.getAttribute('data-type')
            const _botStatus = _botContainer.querySelector(`#${_type}-status`)
            const _botOptions = _botContainer.querySelector(`#${_type}-options`)
            const _botIcon = _botStatus.querySelector(`#${_type}-icon`)
//          const _botOptionsDropdown = _botStatus.querySelector(`#${_type}-options-dropdown`);
            const _botName = _botOptions.querySelector(`#${_type}-bot_name`)
            const _botNameInput = _botName.querySelector('input')
            /* logic */
            _bot.status = getBotStatus(_bot, _botIcon)
            // @todo: architect mechanic for bot-specific options
            switch(_botContainer.getAttribute('data-type')){
                case 'personal-biographer':
                    _botContainer.setAttribute('data-dob', _bot?.dob.split('T')[0]??'')
                    _botNameInput.value = _botContainer.getAttribute('data-bot_name')
                    _botContainer.querySelector(`#${_type}-dob`).value = _botContainer.getAttribute('data-dob')
                    // Reference to the ticker
                    const _botNameTicker = document.querySelector(`#${_type}-name-ticker`)
                    _botNameInput.value = _botContainer.getAttribute('data-bot_name')
                    if(_botNameTicker) _botNameTicker.innerHTML = _botNameInput.value
                    _botNameInput.addEventListener('input', function() {
                        _botContainer.setAttribute('data-bot_name', _botNameInput.value)
                        if(_botNameTicker) _botNameTicker.innerHTML = _botNameInput.value
                    })
                    const _interests = _botContainer.querySelector(`#${_type}-interests`)
                    const _checkboxes = _interests.querySelectorAll('input[type="checkbox"]')
                    if(_bot.interests?.length){
                        console.log('interests', _bot.interests)
                        _botContainer.setAttribute('data-interests', _bot.interests)
                        const _interestsArray = _bot.interests.split('; ')
                        _checkboxes.forEach(_checkbox => {
                            if(_interestsArray.includes(_checkbox.value)){
                                _checkbox.checked = true
                            }
                        })
                    }
                    /* add listeners to checkboxes */
                    _checkboxes.forEach(_checkbox => {
                        _checkbox.addEventListener('change', function() {
                            /* concatenate checked values */
                            const checkedValues = Array.from(_checkboxes)
                                .filter(cb => cb.checked) // Filter only checked checkboxes
                                .map(cb => cb.value) // Map to their values
                                .join('; ')
                            _botContainer.setAttribute('data-interests', checkedValues)
                        })
                    })
                    /* narrative slider */
                    const _narrativeSlider = _botContainer.querySelector(`#${_type}-narrative`)
                    _botContainer.setAttribute('data-narrative', _bot?.narrative??_narrativeSlider.value)
                    _narrativeSlider.value = _botContainer.getAttribute('data-narrative')
                    _narrativeSlider.addEventListener('input', function() {
                        _botContainer.setAttribute('data-narrative', _narrativeSlider.value);
                    })
                    /* privacy slider */
                    const _privacySlider = _botContainer.querySelector(`#${_type}-privacy`)
                    _botContainer.setAttribute('data-privacy', _bot?.privacy??_privacySlider.value)
                    _privacySlider.value = _botContainer.getAttribute('data-privacy')
                    console.log('privacy', _privacySlider.value, _bot.privacy)
                    _privacySlider.addEventListener('input', function() {
                        _botContainer.setAttribute('data-privacy', _privacySlider.value);
                    })
                    break
                default:
                    break
            }
        } else {
            // @todo: push to home-grown bots
        }
    })
}