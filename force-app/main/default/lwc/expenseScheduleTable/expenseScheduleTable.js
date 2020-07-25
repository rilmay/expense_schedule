import { LightningElement, wire, track } from 'lwc';
import getScheduleByYear from '@salesforce/apex/ExpenseScheduleController.getScheduleByYear';
import updateRecords from '@salesforce/apex/ExpenseScheduleController.updateRecords';
import deleteRecords from '@salesforce/apex/ExpenseScheduleController.deleteRecords';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import {CurrentPageReference} from 'lightning/navigation';
import {registerListener, unregisterAllListeners} from 'c/pubsub';

const months = [
        'January_expected__c',
        'January_actual__c',
        'February_expected__c',
        'February_actual__c',
        'March_expected__c',
        'March_actual__c',
        'April_expected__c',
        'April_actual__c',
        'May_expected__c',
        'May_actual__c',
        'June_expected__c',
        'June_actual__c',
        'July_expected__c',
        'July_actual__c',
        'August_expected__c',
        'August_actual__c',
        'September_expected__c',
        'September_actual__c',
        'October_expected__c',
        'October_actual__c',
        'November_expected__c',
        'November_actual__c',
        'December_expected__c',
        'December_actual__c',
];

const total = [
    'Total_expected__c',
    'Total_actual__c',
];

const monthsWithTotal = months.concat(total);

function copy(data) {
    let copiedArray = Object.assign([],data);
    let array = [];
    for(let i = 0; i < copiedArray.length; i++){
        array.push(Object.assign({}, copiedArray[i]));
    }
    return array;
}

function getCellClassName(column){
    return column + '_class';
}

function processData(data){
    let schedule = copy(data);
    if(schedule.length === 0){
        return schedule;
    }

    let totalRecord = Object.assign({},data[0]);

    for (let i = 1; i < schedule.length; i++) {
        let sch = schedule[i];
        monthsWithTotal.forEach(function(item) {
            totalRecord[item] += sch[item];
        });
    }

    totalRecord.Name = 'Total';
    totalRecord.Id = '0';
    totalRecord.category = 'slds-theme--shade slds-theme--alert-texture';

    schedule.push(totalRecord);

    schedule.forEach(function(row){
        colorizeRow(row);
    })

    return schedule;
}

function colorizeRow(row){
    monthsWithTotal.forEach(function(item, i, array){
        let className = getCellClassName(item);
        if(item.indexOf('expected__c') !== -1){
            row[className] = 'slds-theme--info';
        }else{
            let expectedField = array[i-1];
            if(row[expectedField] < row[item]){
                row[className] = 'slds-theme--error';
            }else{
                row[className] = 'slds-theme--success';
            }
        }
    })
}

function validateRow(row){
    let returnMessage = '';

    
    let isValidString = (string) => {
        let valid = false;
        if(string && string.length > 0 && string.length <= 80){
            valid = true;
        }
        return valid;
    }

    let isValidStringNumber = (num) => {
        let valid = false;
        if(num && typeof num  === 'string' && !isNaN(num)){
            let length = num.length;
            if(length > 0 && length < 18){
                valid = true;
            }
        }
        return valid;
    }

    let concatMessageAboutField = (field)=>{
        if(returnMessage.length > 0){
            returnMessage = returnMessage + ', invalid ' + field + ' field';
        }else{
            let itemMessage = 'Invalid ';

            if (row.Name && isValidString(row.Name)){
                itemMessage = 'Record (name: ' + row.Name + '): invalid ';
            } else {
                itemMessage = 'Record (id: ' + row.Id + '): invalid ';
            }
            
            returnMessage = returnMessage + itemMessage + field + ' field';
        }
    }

    if(!isValidString(row.Id)){
        concatMessageAboutField('Id');
    }

    if(row.Name && !isValidString(row.Name)){
        concatMessageAboutField('Name');
    }

    months.forEach((item) =>{
        if(row[item] && !isValidStringNumber(row[item])){
            concatMessageAboutField(item);
        }
    })

    return returnMessage;
}

function getCurrentYear(){
    return new Date().getFullYear();
}

function getCurrentMonth(){
    return new Date().getMonth();
}

export default class ExpenseScheduleTable extends LightningElement {
    @wire(CurrentPageReference) pageRef;
    @track error;
    @track draftValues = [];
    @track year = getCurrentYear();
    @track selectedIds = [];

    @track sortBy;
    @track sortDirection;

    @wire(getScheduleByYear, {year: '$year'})
    rawData

    get columns(){
        let monthNum = getCurrentMonth();
        let cols = [];

        let addCategory = (sortable, editable) => {
            cols.push({ label: 'Category', fieldName: 'Name',sortable, editable, fixedWidth: 130, cellAttributes: { class: { fieldName: 'category' }}});

        }
        addCategory(true, true);
        
        monthsWithTotal.forEach(function(item){
            let postfix = 'act';
            let monthName = item.slice(0,3);
            if(item.indexOf('expected__c') !== -1){
                postfix = 'exp';
            }
            let col = { label: monthName + ' ' + postfix, fieldName: item, editable: true, sortable: true, type: 'currency', cellAttributes: { alignment: 'left', class: { fieldName: getCellClassName(item) }}, fixedWidth: 100};
            if(item.indexOf('Total') !== -1){
                col.editable = false;
                col.label = 'Total ' + postfix;
            }
            cols.push(col);
        })

        addCategory(false, false);

        cols.splice(1, 0, cols[monthNum * 2 + 1], cols[monthNum * 2 + 2]);
        cols.splice(monthNum * 2 + 3, 2);

        return cols;
    }

    setSelectedRows(event){
        this.selectedIds = event.detail.selectedRows
                                .filter(function(item) {return item.Id !== '0'})
                                .map(function(item){return item.Id});
    }

    deleteSelected(){
        if(this.selectedIds.length > 0){
            deleteRecords({ids: this.selectedIds}).then(
                result => {
                    this.resultToastWindow(result, 'Records have been deleted')
                    this.selectedIds = [];
                    this.resetWindow();
                }
            )
        }
    }

    connectedCallback() {
        registerListener('previousYear', this.handlePreviousYear, this);
        registerListener('nextYear', this.handleNextYear, this);
    }

    resetWindow(){
        this.draftValues = [];
        this.resetInput();
        refreshApex(this.rawData);
    }

    resultToastWindow(result, messageSuccess){
        let ifSuccess = (result === 'ok');
        this.dispatchEvent(
            new ShowToastEvent({
                title: (ifSuccess)? 'Success': 'Error',
                message: (ifSuccess)? messageSuccess : result,
                variant: (ifSuccess)? 'success' : 'error'
            })
        );
    }

    handleNextYear(){
        this.year += 1;
        this.resetWindow();
    }

    handlePreviousYear(){
        this.year -= 1;
        this.resetWindow();
    }

    disconnectedCallback() {
        unregisterAllListeners(this);
    }

    get schedule(){
        let processedData = processData(this.rawData.data);
        this.sortData(processedData)
        return processedData;
    }

    handleSortdata(event) {
        this.sortBy = event.detail.fieldName;

        this.sortDirection = event.detail.sortDirection;
    }

    sortData(data){
        if(!(this.sortBy || this.sortDirection)){
            return;
        }

        let keyValue = (a) => {
            return a[this.sortBy];
        };

        let isTotal = (a) => {
            return a.Id === '0';
        }

        let isReverse = this.sortDirection === 'asc' ? 1: -1;

        data.sort((x, y) => {
            if(isTotal(x)){
                return 1;
            }
            if(isTotal(y)){
                return -1;
            }
            
            let fieldValueX = keyValue(x);
            let fieldValueY = keyValue(y);

            return isReverse * ((fieldValueX > fieldValueY) - (fieldValueY > fieldValueX));
        });
    }

    handleSave(event) {
        let recordArray = [];
        let errorMsgs = '';
        event.detail.draftValues.forEach(function(item){
            if(item.Id !== '0'){
                let message = validateRow(item);
                if(message.length === 0){
                    let recToUpdate = {};
                    recToUpdate.Id = item.Id;
                    recToUpdate.Name = item.Name;
                    months.forEach(function(month){
                        recToUpdate[month] = item[month];
                    })
                    recordArray.push(recToUpdate);
                }else{
                    errorMsgs = errorMsgs + ((errorMsgs.length > 0)?'. ':'') + message;
                }
            }
        })
        if(recordArray.length > 0){
            updateRecords({schedules: recordArray}).then(
                result => {
                    this.resultToastWindow(result, 'Records (' + recordArray.length + ') have been updated');
                    this.resetWindow();
                }
            )
        }
        if(errorMsgs.length > 0){
            this.resultToastWindow(errorMsgs);
        }
    }
    handleSuccess(){
        this.resultToastWindow('ok', 'Category created');
        this.resetWindow();
    }

    resetInput() {
        const inputFields = this.template.querySelectorAll(
            'lightning-input-field'
        );
        if (inputFields) {
            inputFields.forEach(field => {
                field.reset();
            });
        }
     }
    
}