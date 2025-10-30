/**
 * Form Command Recognition Tests
 * Tests the CommandNormalizer's ability to recognize and parse form-related voice commands
 */

import { CommandNormalizer } from '../services/stt/src/commandNormalizer.js';

// Test cases for form commands
const formTestCases = [
    // Fill/Enter commands
    {
        input: 'fill username',
        expected: {
            intent: 'form_action',
            slots: { action: 'fill', field: 'username' },
            description: 'Basic fill command'
        }
    },
    {
        input: 'fill in email',
        expected: {
            intent: 'form_action',
            slots: { action: 'fill', field: 'email' },
            description: 'Fill with "in" preposition'
        }
    },
    {
        input: 'enter password secret123',
        expected: {
            intent: 'form_action',
            slots: { action: 'fill', field: 'password', value: 'secret123' },
            description: 'Enter with value'
        }
    },
    {
        input: 'type name John Doe',
        expected: {
            intent: 'form_action',
            slots: { action: 'fill', field: 'name', value: 'John Doe' },
            description: 'Type with multi-word value'
        }
    },
    {
        input: 'fill email john@example.com',
        expected: {
            intent: 'form_action',
            slots: { action: 'fill', field: 'email', value: 'john@example.com' },
            description: 'Fill email with value'
        }
    },

    // Submit commands
    {
        input: 'submit form',
        expected: {
            intent: 'form_action',
            slots: { action: 'submit' },
            description: 'Submit form'
        }
    },
    {
        input: 'submit',
        expected: {
            intent: 'form_action',
            slots: { action: 'submit' },
            description: 'Submit (short form)'
        }
    },
    {
        input: 'send form',
        expected: {
            intent: 'form_action',
            slots: { action: 'submit' },
            description: 'Send form (synonym)'
        }
    },

    // Check/Select commands
    {
        input: 'check remember me',
        expected: {
            intent: 'form_action',
            slots: { action: 'select', field: 'remember me', target: 'remember me' },
            description: 'Check checkbox'
        }
    },
    {
        input: 'check box terms',
        expected: {
            intent: 'form_action',
            slots: { action: 'select', field: 'terms', target: 'terms' },
            description: 'Check box with "box" keyword'
        }
    },
    {
        input: 'select country',
        expected: {
            intent: 'form_action',
            slots: { action: 'select', field: 'country', target: 'country' },
            description: 'Select dropdown'
        }
    },
    {
        input: 'choose option standard',
        expected: {
            intent: 'form_action',
            slots: { action: 'select', field: 'standard', target: 'standard' },
            description: 'Choose option'
        }
    },

    // List fields command
    {
        input: 'list fields',
        expected: {
            intent: 'form_action',
            slots: { action: 'list', field: 'fields' },
            description: 'List all fields'
        }
    },
    {
        input: 'show fields',
        expected: {
            intent: 'form_action',
            slots: { action: 'list', field: 'fields' },
            description: 'Show fields (synonym)'
        }
    }
];

// Run tests
function runFormCommandTests() {
    console.log('🧪 Running Form Command Recognition Tests...\n');

    const normalizer = new CommandNormalizer();
    let passed = 0;
    let failed = 0;
    const failures = [];

    formTestCases.forEach((testCase, index) => {
        const result = normalizer.normalize(testCase.input);

        // Check intent
        const intentMatch = result.intent === testCase.expected.intent;

        // Check slots (at least the action should match)
        const actionMatch = !testCase.expected.slots.action ||
            result.slots.action === testCase.expected.slots.action;

        // For fill commands, check field extraction
        const fieldMatch = !testCase.expected.slots.field ||
            (result.slots.field && result.slots.field.includes(testCase.expected.slots.field));

        const testPassed = intentMatch && actionMatch && (fieldMatch || !testCase.expected.slots.field);

        if (testPassed) {
            passed++;
            console.log(`✅ Test ${index + 1}: ${testCase.description}`);
            console.log(`   Input: "${testCase.input}"`);
            console.log(`   Intent: ${result.intent}, Slots:`, result.slots);
        } else {
            failed++;
            failures.push({
                test: index + 1,
                description: testCase.description,
                input: testCase.input,
                expected: testCase.expected,
                actual: { intent: result.intent, slots: result.slots }
            });
            console.log(`❌ Test ${index + 1}: ${testCase.description}`);
            console.log(`   Input: "${testCase.input}"`);
            console.log(`   Expected:`, testCase.expected);
            console.log(`   Got:`, { intent: result.intent, slots: result.slots });
        }
        console.log('');
    });

    // Summary
    console.log('='.repeat(60));
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed out of ${formTestCases.length} tests`);
    console.log(`Success Rate: ${Math.round((passed / formTestCases.length) * 100)}%`);
    console.log('='.repeat(60));

    if (failures.length > 0) {
        console.log('\n❌ Failed Tests:');
        failures.forEach(failure => {
            console.log(`\nTest ${failure.test}: ${failure.description}`);
            console.log(`Input: "${failure.input}"`);
            console.log(`Expected:`, failure.expected);
            console.log(`Got:`, failure.actual);
        });
    }

    return { passed, failed, total: formTestCases.length };
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    runFormCommandTests();
}

export { runFormCommandTests, formTestCases };
