/**
 * Command Executor for Content Script
 * Executes normalized commands on the active page
 * Works with FeedbackManager for confirmations
 */

export class CommandExecutor {
  constructor(feedbackManager) {
    this.feedbackManager = feedbackManager;
    this.linkList = [];
    this.currentSearchIndex = 0;
    
    console.log('[Executor] Initialized');
  }

  /**
   * Execute a normalized command
   * @param {Object} command - Normalized command from CommandNormalizer
   * @returns {Promise<Object>} Execution result
   */
  async execute(command) {
    const intent = command.intent || command.normalized?.intent;
    const slots = command.slots || command.normalized?.slots || {};

    console.log('[Executor] Executing:', intent, slots);

    try {
      let result;

      switch (intent) {
        case 'navigate':
          result = await this.executeNavigate(slots);
          break;

        case 'read':
          result = await this.executeRead(slots);
          break;

        case 'zoom':
          result = await this.executeZoom(slots);
          break;

        case 'link_action':
          result = await this.executeLinkAction(slots);
          break;

        case 'find_content':
          result = await this.executeFindContent(slots);
          break;

        case 'help':
          result = await this.executeHelp();
          break;

        case 'form_action':
          result = await this.executeFormAction(slots);
          break;

        default:
          result = {
            success: false,
            message: `Unknown command: ${intent}`
          };
      }

      // Provide feedback
      if (result.success && this.feedbackManager) {
        this.feedbackManager.confirmCommand(command);
      } else if (!result.success && this.feedbackManager) {
        this.feedbackManager.showError(result.message || 'Command failed');
      }

      return result;

    } catch (err) {
      console.error('[Executor] Execution error:', err);
      
      if (this.feedbackManager) {
        this.feedbackManager.showError('Error: ' + err.message);
      }

      return {
        success: false,
        message: err.message,
        error: err
      };
    }
  }

  /**
   * Execute navigation commands
   */
  async executeNavigate(slots) {
    const direction = slots.direction;
    const amount = slots.amount || 'normal';
    const target = slots.target;

    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return { success: true, message: 'Scrolled to top' };
    }

    if (target === 'bottom') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return { success: true, message: 'Scrolled to bottom' };
    }

    if (direction === 'back') {
      window.history.back();
      return { success: true, message: 'Going back' };
    }

    if (direction === 'forward') {
      window.history.forward();
      return { success: true, message: 'Going forward' };
    }

    // Scroll up/down
    const scrollAmount = amount === 'large' ? window.innerHeight * 0.9 : window.innerHeight * 0.5;
    const scrollY = direction === 'down' ? scrollAmount : -scrollAmount;

    window.scrollBy({ top: scrollY, behavior: 'smooth' });
    
    return {
      success: true,
      message: `Scrolled ${direction}`
    };
  }

  /**
   * Execute reading commands
   */
  async executeRead(slots) {
    const action = slots.action;

    if (action === 'stop') {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        return { success: true, message: 'Stopped reading' };
      }
      return { success: false, message: 'Not currently reading' };
    }

    if (action === 'pause') {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        return { success: true, message: 'Paused reading' };
      }
      return { success: false, message: 'Not currently reading' };
    }

    if (action === 'resume') {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        return { success: true, message: 'Resumed reading' };
      }
      return { success: false, message: 'Nothing to resume' };
    }

    // Start reading
    const text = this.extractPageText();
    
    if (!text) {
      return { success: false, message: 'No text found to read' };
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    window.speechSynthesis.speak(utterance);

    return { success: true, message: 'Started reading' };
  }

  /**
   * Execute zoom commands
   */
  async executeZoom(slots) {
    const action = slots.action;
    const amount = parseFloat(slots.amount) || 0.1;

    // Get current zoom level
    let currentZoom = parseFloat(document.body.style.zoom) || 1.0;

    if (action === 'in' || action === 'bigger') {
      currentZoom += amount;
    } else if (action === 'out' || action === 'smaller') {
      currentZoom -= amount;
    } else if (action === 'reset' || action === 'normal') {
      currentZoom = 1.0;
    }

    // Clamp zoom level
    currentZoom = Math.max(0.5, Math.min(3.0, currentZoom));

    document.body.style.zoom = currentZoom;

    return {
      success: true,
      message: `Zoom: ${Math.round(currentZoom * 100)}%`
    };
  }

  /**
   * Execute link actions
   */
  async executeLinkAction(slots) {
    const action = slots.action;
    const linkNumber = slots.linkNumber;
    const target = slots.target;

    if (action === 'list' || !action) {
      // List all links
      this.linkList = Array.from(document.querySelectorAll('a[href]'));
      
      const linkTexts = this.linkList
        .slice(0, 10)
        .map((link, i) => {
          const text = link.textContent.trim() || link.href;
          return `${i + 1}. ${text.substring(0, 50)}`;
        })
        .join('\n');

      console.log('[Executor] Found links:\n', linkTexts);

      // Show overlay with links
      this.showLinkList(this.linkList.slice(0, 10));

      return {
        success: true,
        message: `Found ${this.linkList.length} links`
      };
    }

    if (linkNumber !== undefined) {
      // Open link by number
      const index = linkNumber - 1;
      
      if (index >= 0 && index < this.linkList.length) {
        const link = this.linkList[index];
        link.click();
        return {
          success: true,
          message: `Opening link ${linkNumber}`
        };
      }

      return {
        success: false,
        message: `Link ${linkNumber} not found`
      };
    }

    if (target) {
      // Find link by text
      const link = Array.from(document.querySelectorAll('a[href]'))
        .find(a => a.textContent.toLowerCase().includes(target.toLowerCase()));

      if (link) {
        link.click();
        return {
          success: true,
          message: `Opening ${target}`
        };
      }

      return {
        success: false,
        message: `Link "${target}" not found`
      };
    }

    return { success: false, message: 'Invalid link action' };
  }

  /**
   * Execute find/search commands
   */
  async executeFindContent(slots) {
    const query = slots.query;

    if (!query) {
      return { success: false, message: 'No search query provided' };
    }

    // Use browser's find function
    const found = window.find(query, false, false, true);

    if (found) {
      return {
        success: true,
        message: `Found "${query}"`
      };
    }

    // Try case-insensitive
    const foundCaseInsensitive = window.find(query, false, false, false);
    
    if (foundCaseInsensitive) {
      return {
        success: true,
        message: `Found "${query}"`
      };
    }

    return {
      success: false,
      message: `"${query}" not found`
    };
  }

  /**
   * Execute help command
   */
  async executeHelp() {
    const helpText = `
Voice Commands Available:
• Navigation: "scroll down", "scroll up", "go to top", "go back"
• Reading: "read page", "stop reading", "pause", "resume"
• Zoom: "zoom in", "zoom out", "reset zoom"
• Links: "list links", "open link 1", "click on about"
• Search: "find login", "search for contact"
• Help: "help", "what can you do"

Say "Hoda" + command, or just the command directly.
    `.trim();

    this.showHelpOverlay(helpText);

    return {
      success: true,
      message: 'Showing help'
    };
  }

  /**
   * Execute form actions
   */
  async executeFormAction(slots) {
    const action = slots.action;
    const field = slots.field;
    const value = slots.value;
    const target = slots.target;

    console.log('[Executor] Form action:', { action, field, value, target });

    try {
      // Detect all forms on page
      const forms = this.detectForms();

      if (forms.length === 0) {
        return {
          success: false,
          message: 'No forms found on page'
        };
      }

      // Get all form fields
      const allFields = this.getAllFormFields(forms);

      // Handle "list fields" command
      if (action === 'list' || (field && field.toLowerCase() === 'fields')) {
        this.showFieldList(allFields);
        return {
          success: true,
          message: `Found ${allFields.length} form fields`
        };
      }

      // Handle form submission
      if (action === 'submit') {
        return await this.handleFormSubmission(forms[0]);
      }

      // Handle field filling
      if ((action === 'fill' || action === 'enter' || action === 'type') && field) {
        return await this.handleFieldFill(allFields, field, value);
      }

      // Handle selection controls (checkbox, radio, dropdown)
      if ((action === 'select' || action === 'check' || action === 'choose') && (field || target)) {
        return await this.handleFieldSelection(allFields, field || target);
      }

      return {
        success: false,
        message: 'Invalid form action'
      };

    } catch (err) {
      console.error('[Executor] Form action error:', err);
      return {
        success: false,
        message: err.message || 'Form action failed'
      };
    }
  }

  /**
   * Detect all forms on the page
   */
  detectForms() {
    const forms = Array.from(document.querySelectorAll('form'));
    console.log(`[Executor] Found ${forms.length} forms`);
    return forms;
  }

  /**
   * Get all form fields from all forms
   */
  getAllFormFields(forms) {
    const fields = [];

    forms.forEach(form => {
      const inputs = form.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
      );

      inputs.forEach(input => {
        // Skip hidden or disabled fields
        if (input.offsetParent === null || input.disabled) return;

        const label = this.getFieldLabel(input);
        const fieldInfo = {
          element: input,
          label: label,
          name: input.name || input.id || '',
          type: input.type || input.tagName.toLowerCase(),
          id: input.id
        };

        fields.push(fieldInfo);
      });
    });

    console.log(`[Executor] Found ${fields.length} visible fields`);
    return fields;
  }

  /**
   * Get label text for a form field
   */
  getFieldLabel(input) {
    // Try to find associated label
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Try parent label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.replace(input.value, '').trim();
    }

    // Try aria-label
    if (input.getAttribute('aria-label')) {
      return input.getAttribute('aria-label');
    }

    // Try placeholder
    if (input.placeholder) {
      return input.placeholder;
    }

    // Try name/id as fallback
    return input.name || input.id || 'Unknown field';
  }

  /**
   * Find form field by name/label
   */
  findFormField(fields, fieldName) {
    const lowerName = fieldName.toLowerCase();

    // Try exact match first
    let field = fields.find(f =>
      f.label.toLowerCase() === lowerName ||
      f.name.toLowerCase() === lowerName ||
      f.id.toLowerCase() === lowerName
    );

    if (field) return field;

    // Try partial match
    field = fields.find(f =>
      f.label.toLowerCase().includes(lowerName) ||
      f.name.toLowerCase().includes(lowerName) ||
      f.id.toLowerCase().includes(lowerName)
    );

    return field || null;
  }

  /**
   * Handle field filling
   */
  async handleFieldFill(fields, fieldName, value) {
    const field = this.findFormField(fields, fieldName);

    if (!field) {
      return {
        success: false,
        message: `Field "${fieldName}" not found. Say "list fields" to see available fields.`
      };
    }

    // Show field found overlay
    this.showFieldFoundOverlay(field);

    // If no value provided, wait for next command with the value
    if (!value) {
      return {
        success: true,
        message: `Found "${field.label}" field. Say the value to fill.`,
        requiresValue: true,
        pendingField: field
      };
    }

    // Fill the field
    field.element.value = value;
    field.element.dispatchEvent(new Event('input', { bubbles: true }));
    field.element.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      message: `Filled "${field.label}" with "${value}"`
    };
  }

  /**
   * Handle field selection (checkbox, radio, dropdown)
   */
  async handleFieldSelection(fields, fieldName) {
    const field = this.findFormField(fields, fieldName);

    if (!field) {
      return {
        success: false,
        message: `Field "${fieldName}" not found. Say "list fields" to see available fields.`
      };
    }

    const element = field.element;

    // Handle checkbox
    if (element.type === 'checkbox') {
      element.checked = !element.checked;
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        success: true,
        message: `${element.checked ? 'Checked' : 'Unchecked'} "${field.label}"`
      };
    }

    // Handle radio
    if (element.type === 'radio') {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        success: true,
        message: `Selected "${field.label}"`
      };
    }

    // Handle select dropdown
    if (element.tagName.toLowerCase() === 'select') {
      // Show options
      const options = Array.from(element.options).map((opt, i) => ({
        index: i,
        text: opt.text,
        value: opt.value
      }));

      this.showSelectOptions(field, options);

      return {
        success: true,
        message: `Showing options for "${field.label}". Say the option number.`,
        requiresSelection: true,
        pendingField: field,
        options: options
      };
    }

    return {
      success: false,
      message: `Cannot select field type: ${field.type}`
    };
  }

  /**
   * Handle form submission
   */
  async handleFormSubmission(form) {
    // Validate form first
    const isValid = form.checkValidity();

    if (!isValid) {
      // Find first invalid field
      const invalidFields = Array.from(form.querySelectorAll(':invalid'));

      if (invalidFields.length > 0) {
        const firstInvalid = invalidFields[0];
        const label = this.getFieldLabel(firstInvalid);
        const validationMsg = firstInvalid.validationMessage;

        this.showValidationError(label, validationMsg);

        return {
          success: false,
          message: `Validation error: ${label} - ${validationMsg}`
        };
      }
    }

    // Show confirmation overlay
    this.showSubmitConfirmation(form);

    return {
      success: true,
      message: 'Ready to submit form. Say "confirm" to proceed or "cancel" to abort.',
      requiresConfirmation: true,
      pendingForm: form
    };
  }

  /**
   * Show list of form fields
   */
  showFieldList(fields) {
    const overlay = this.createOverlay('hoda-field-list');

    const fieldsByType = {
      text: fields.filter(f => ['text', 'email', 'password', 'tel', 'textarea'].includes(f.type)),
      checkbox: fields.filter(f => f.type === 'checkbox'),
      radio: fields.filter(f => f.type === 'radio'),
      select: fields.filter(f => f.type === 'select')
    };

    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">
        📋 Form Fields (${fields.length} total)
      </div>
      ${fieldsByType.text.length > 0 ? `
        <div style="margin: 10px 0;">
          <strong>Text Fields:</strong>
          <ul style="margin: 5px 0; padding-left: 20px;">
            ${fieldsByType.text.map(f => `<li>${f.label}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${fieldsByType.checkbox.length > 0 ? `
        <div style="margin: 10px 0;">
          <strong>Checkboxes:</strong>
          <ul style="margin: 5px 0; padding-left: 20px;">
            ${fieldsByType.checkbox.map(f => `<li>${f.label}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${fieldsByType.select.length > 0 ? `
        <div style="margin: 10px 0;">
          <strong>Dropdowns:</strong>
          <ul style="margin: 5px 0; padding-left: 20px;">
            ${fieldsByType.select.map(f => `<li>${f.label}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div style="font-size: 12px; opacity: 0.8; margin-top: 10px;">
        Say "fill [field name]" to enter data
      </div>
    `;
  }

  /**
   * Show field found overlay
   */
  showFieldFoundOverlay(field) {
    const overlay = this.createOverlay('hoda-field-found');
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">
        📋 Field Found
      </div>
      <div style="margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 4px;">
        <strong>${field.label}</strong>
        <div style="font-size: 12px; opacity: 0.7; margin-top: 5px;">
          Type: ${field.type}
        </div>
      </div>
      <div style="font-size: 12px; opacity: 0.8;">
        Say the value to fill, or "cancel"
      </div>
    `;

    // Highlight the field
    field.element.style.outline = '3px solid #4CAF50';
    field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Remove highlight after 3 seconds
    setTimeout(() => {
      field.element.style.outline = '';
    }, 3000);
  }

  /**
   * Show select dropdown options
   */
  showSelectOptions(field, options) {
    const overlay = this.createOverlay('hoda-select-options');
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">
        📋 ${field.label} Options
      </div>
      <ul style="margin: 10px 0; padding-left: 20px; max-height: 300px; overflow-y: auto;">
        ${options.slice(0, 10).map(opt =>
          `<li><strong>${opt.index + 1}.</strong> ${opt.text}</li>`
        ).join('')}
      </ul>
      <div style="font-size: 12px; opacity: 0.8;">
        Say the option number (1-${Math.min(options.length, 10)})
      </div>
    `;
  }

  /**
   * Show submit confirmation overlay
   */
  showSubmitConfirmation(form) {
    const overlay = this.createOverlay('hoda-submit-confirm');

    // Count filled fields
    const fields = form.querySelectorAll('input, select, textarea');
    const filledCount = Array.from(fields).filter(f => f.value).length;

    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">
        ✅ Ready to Submit
      </div>
      <div style="margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 4px;">
        <div>${filledCount} fields filled</div>
      </div>
      <div style="font-size: 12px; opacity: 0.8;">
        Say "confirm" to submit, or "cancel"
      </div>
    `;
  }

  /**
   * Show validation error overlay
   */
  showValidationError(fieldLabel, message) {
    const overlay = this.createOverlay('hoda-validation-error');
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #ff6b6b;">
        ❌ Validation Error
      </div>
      <div style="margin: 10px 0; padding: 10px; background: rgba(255,107,107,0.2); border-radius: 4px;">
        <strong>${fieldLabel}</strong>
        <div style="margin-top: 5px;">${message}</div>
      </div>
      <div style="font-size: 12px; opacity: 0.8;">
        Say "fill ${fieldLabel}" to correct
      </div>
    `;
  }

  /**
   * Helper: Extract readable text from page
   */
  extractPageText() {
    // Get main content
    const main = document.querySelector('main, article, .content, [role="main"]');
    const target = main || document.body;

    // Get text, removing script/style content
    const clone = target.cloneNode(true);
    clone.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());

    return clone.textContent.trim().substring(0, 5000); // Limit length
  }

  /**
   * Helper: Show link list overlay
   */
  showLinkList(links) {
    const overlay = this.createOverlay('hoda-link-list');
    
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">
        📎 Available Links
      </div>
      ${links.map((link, i) => {
        const text = link.textContent.trim() || link.href;
        return `
          <div style="margin: 5px 0; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 4px;">
            <strong>${i + 1}.</strong> ${text.substring(0, 60)}
          </div>
        `;
      }).join('')}
      <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
        Say "open link [number]" to open
      </div>
    `;

    overlay.style.maxHeight = '400px';
    overlay.style.overflowY = 'auto';
  }

  /**
   * Helper: Show help overlay
   */
  showHelpOverlay(text) {
    const overlay = this.createOverlay('hoda-help');
    
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">
        🎤 Hoda Voice Commands
      </div>
      <pre style="white-space: pre-wrap; font-family: system-ui; font-size: 13px; line-height: 1.6;">
${text}
      </pre>
    `;

    overlay.style.maxWidth = '500px';
    overlay.style.maxHeight = '600px';
    overlay.style.overflowY = 'auto';
  }

  /**
   * Helper: Create overlay element
   */
  createOverlay(id) {
    // Remove existing
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = id;
    
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '80px',
      right: '20px',
      padding: '20px',
      borderRadius: '12px',
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      zIndex: '2147483646',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      maxWidth: '400px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    });

    document.body.appendChild(overlay);

    // Auto-hide after 8 seconds
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      setTimeout(() => overlay.remove(), 500);
    }, 8000);

    return overlay;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.linkList = [];
    
    // Remove overlays
    ['hoda-link-list', 'hoda-help'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    console.log('[Executor] Destroyed');
  }
}

export default CommandExecutor;