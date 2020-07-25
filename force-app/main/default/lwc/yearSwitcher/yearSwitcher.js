import { LightningElement, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { fireEvent } from 'c/pubsub';


function getCurrentYear(){
    return new Date().getFullYear();
}

const limit = 5;

export default class YearSwitcher extends LightningElement {

    @wire(CurrentPageReference) pageRef;
    @track year = getCurrentYear();

    previousYear(){
        this.year -= 1;
        fireEvent(this.pageRef, 'previousYear');
    }

    nextYear(){
        this.year +=1;
        fireEvent(this.pageRef, 'nextYear');
    }

    get nextClass(){
        if(this.year <= getCurrentYear() + limit){
            return '';
        }else{
            return 'slds-hidden';
        }
    }

    get previousClass(){
        if(this.year >= getCurrentYear() - limit){
            return '';
        }else{
            return 'slds-hidden';
        }
    }
}