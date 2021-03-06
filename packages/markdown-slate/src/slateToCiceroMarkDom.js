/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const NS = 'org.accordproject.commonmark';
const NS_CICERO = 'org.accordproject.ciceromark';


/**
 * Removes nodes if they are an empty paragraph
 * @param {*} input - the current result of slateToCiceroMarkDom
 * @returns {*} the final result of slateToCiceroMarkDom
 */
const removeEmptyParagraphs = (input) => {
    let nodesWithoutBlankParagraphs = [];
    input.nodes.forEach(node => {
        if (node.$class === 'org.accordproject.commonmark.Paragraph' &&
            node.nodes.length === 1 &&
            node.nodes[0].$class === 'org.accordproject.commonmark.Text' &&
            node.nodes[0].text === '') {
            return;
        }
        nodesWithoutBlankParagraphs.push(node);
    });
    input.nodes = nodesWithoutBlankParagraphs;
    return input;
};

/**
 * Gather the text for the node
 * @param {*} input - the current slate node
 * @returns {string} the text contained in the slate node
 */
const getText = (input) => {
    let result = '';
    if (input.text) {
        result += input.text;
    }
    if (input.nodes) {
        input.nodes.forEach(node => {
            result += getText(node);
        });
    }
    return result;
};

/**
 * Converts a Slate document node to CiceroMark DOM (as JSON)
 * @param {*} document the Slate document node
 * @returns {*} the CiceroMark DOM as a Concerto object
 */
function slateToCiceroMarkDom(document) {

    const result = {
        $class : 'org.accordproject.commonmark.Document',
        xmlns : 'http://commonmark.org/xml/1.0',
        nodes : []
    };
    // convert the value to a plain object
    const json = document;
    _recursive(result, json.nodes);
    return removeEmptyParagraphs(result);
}

/**
 * Converts an array of Slate nodes, pushing them into the parent
 * @param {*} parent the parent CiceroMark DOM node
 * @param {*} nodes an array of Slate nodes
 */
function _recursive(parent, nodes) {

    nodes.forEach((node, index) => {
        let result = null;

        switch (node.object) {
        case 'text':
            result = handleText(node);
            break;
        default:
            switch(node.type) {
            case 'clause':
                // console.log(JSON.stringify(node, null, 4));
                result = {$class : `${NS_CICERO}.Clause`, clauseid: node.data.clauseid, src: node.data.src, nodes: []};
                break;
            case 'variable':
            case 'conditional':
            case 'computed':
                result = handleVariable(node);
                break;
            case 'paragraph':
                result = {$class : `${NS}.Paragraph`, nodes: []};
                break;
            case 'softbreak':
                result = {$class : `${NS}.Softbreak`};
                break;
            case 'linebreak':
                result = {$class : `${NS}.Linebreak`};
                break;
            case 'horizontal_rule':
                result = {$class : `${NS}.ThematicBreak`};
                break;
            case 'heading_one':
                result = {$class : `${NS}.Heading`, level : '1', nodes: []};
                break;
            case 'heading_two':
                result = {$class : `${NS}.Heading`, level : '2', nodes: []};
                break;
            case 'heading_three':
                result = {$class : `${NS}.Heading`, level : '3', nodes: []};
                break;
            case 'heading_four':
                result = {$class : `${NS}.Heading`, level : '4', nodes: []};
                break;
            case 'heading_five':
                result = {$class : `${NS}.Heading`, level : '5', nodes: []};
                break;
            case 'heading_six':
                result = {$class : `${NS}.Heading`, level : '6', nodes: []};
                break;
            case 'block_quote':
                result = {$class : `${NS}.BlockQuote`, nodes: []};
                break;
            case 'code_block':
                result = {$class : `${NS}.CodeBlock`, text: getText(node)};
                break;
            case 'html_block':
                result = {$class : `${NS}.HtmlBlock`, text: getText(node)};
                break;
            case 'html_inline':
                result = {$class : `${NS}.HtmlInline`, text: node.data.content};
                break;
            case 'ol_list':
            case 'ul_list': {
                result = {$class : node.data.kind === 'variable' ? `${NS_CICERO}.ListVariable` : `${NS}.List`, type: node.type === 'ol_list' ? 'ordered' : 'bullet', delimiter: node.data.delimiter, start: node.data.start, tight: node.data.tight, nodes: []};
            }
                break;
            case 'list_item':
                result = {$class : `${NS}.Item`, nodes: []};
                break;
            case 'link':
                result = {$class : `${NS}.Link`, destination: node.data.href, title: node.data.title ? node.data.title : '', nodes: []};
                break;
            case 'image':
                result = {$class : `${NS}.Image`, destination: node.data.href, title: node.data.title ? node.data.title : '', nodes: []};
                break;
            }
        }

        if(!result) {
            throw Error(`Failed to process node ${JSON.stringify(node)}`);
        }

        // process any children, attaching to first child if it exists (for list items)
        if(node.nodes && result.nodes) {
            _recursive(result.nodes[0] ? result.nodes[0] : result, node.nodes);
        }

        if(!parent.nodes) {
            throw new Error(`Parent node doesn't have children ${JSON.stringify(parent)}`);
        }
        parent.nodes.push(result);
    });
}

/**
 * Handles a text node
 * @param {*} node the slate text node
 * @returns {*} the ast node
 */
function handleText(node) {
    let strong = null;
    let emph = null;
    let result = null;

    const isBold = node.marks.some(mark => mark.type === 'bold');
    const isItalic = node.marks.some(mark => mark.type === 'italic');
    const isCode = node.marks.some(mark => mark.type === 'code');

    if (isCode) {
        result = {$class : `${NS}.Code`, text: node.text};
    }

    const text = {
        $class : `${NS}.Text`,
        text : node.text
    };

    if (isBold) {
        strong = {$class : `${NS}.Strong`, nodes: []};
    }

    if (isItalic) {
        emph  = {$class : `${NS}.Emph`, nodes: []};
    }

    if(strong && emph) {
        result = emph;
        emph.nodes.push(strong);
        strong.nodes.push(text);
    }
    else {
        if(strong) {
            result = strong;
            strong.nodes.push(text);
        }

        if(emph) {
            result = emph;
            emph.nodes.push(text);
        }
    }

    if(!result) {
        result = text;
    }

    return result;
}

/**
 * Handles a variable node
 * @param {*} node the slate variable node
 * @returns {*} the ast node
 */
function handleVariable(node) {

    let result = null;

    const textNode = node.nodes[0]; // inlines always contain a single text node
    node.nodes = []; // Reset the children for the inline to avoid recursion

    const type = node.type;
    const baseName = type === 'variable' ? 'Variable' : type === 'conditional' ? 'ConditionalVariable' : 'ComputedVariable';
    const className = `${NS_CICERO}.${baseName}`;

    result = {
        $class : className,
        value : textNode.text
    };

    const data = node.data;
    if (Object.prototype.hasOwnProperty.call(data,'id')) {
        result.id = data.id;
    }
    if (Object.prototype.hasOwnProperty.call(data,'whenTrue')) {
        result.whenTrue = data.whenTrue;
    }
    if (Object.prototype.hasOwnProperty.call(data,'whenFalse')) {
        result.whenFalse = data.whenFalse;
    }

    return result;
}

module.exports = slateToCiceroMarkDom;