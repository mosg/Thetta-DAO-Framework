pragma solidity ^0.4.15;

import "./IMoneyflow.sol";

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

//////////////////////////////////////////////////////
contract Expense is IWeiReceiver, IWeiDestination, Ownable {
	bool isMoneyReceived = false;
	uint percentsMul100 = 0;
	uint periodHours = 0;
	uint64 momentReceived = 0;
	uint neededWei = 0;
	address moneySource = 0x0;

	function Expense(uint _neededWei, uint _percentsMul100, uint _periodHours) public {
		percentsMul100 = _percentsMul100;
		periodHours = _periodHours;
		neededWei = _neededWei;
	}

	function processFunds(uint _currentFlow) public payable{
		require(isNeedsMoney());

		require(msg.value==getTotalWeiNeeded(_currentFlow));

		if(0!=periodHours){ // TODO: why not works without if
			momentReceived = uint64(now);
		}

		isMoneyReceived = true;
		moneySource = msg.sender;
	}

	function getIsMoneyReceived() constant public returns(bool){
		return isMoneyReceived;
	}

	function getNeededWei() constant public returns(uint){
		return neededWei;
	}	

	function getTotalWeiNeeded(uint _inputWei)constant public returns(uint){
		if(!isNeedsMoney()){
			return 0;
		}

		if(0!=percentsMul100){
			return (percentsMul100 * _inputWei) / 10000;
		}else{
			return getMinWeiNeeded();
		}
	}

	function getMinWeiNeeded()constant public returns(uint){
		if(!isNeedsMoney() || (0!=percentsMul100)){
			return 0;
		}
		return neededWei;
	}

	function isNeedsMoney()constant public returns(bool){	
		if(0!=periodHours){ // For period expense
			if ((uint64(now) - momentReceived) >= periodHours * 3600 * 1000){ 
				return true;
			}
		}
		return !isMoneyReceived;
	}

	modifier onlyByMoneySource() { 
		require(msg.sender==moneySource); 
		_; 
	}
	
	function getPercentsMul100()constant public returns(uint){
		return percentsMul100;
	}

	// TODO: remove from here
	function getNow()constant public returns(uint){
		return now;
	}

	function flush()public onlyOwner{
		msg.sender.transfer(this.balance);
	}

	function flushTo(address _to) public onlyOwner {
		revert();
	}

	function setNeededWei(uint _neededWei) public onlyOwner {
		neededWei = _neededWei;
	}
	
	function setPercents(uint _percentsMul100) public onlyOwner {
		percentsMul100 = _percentsMul100;
	}

	function()public{
	}
}

contract WeiAbsoluteExpense is Expense {
	function WeiAbsoluteExpense(uint _neededWei) public 
		Expense(_neededWei, 0, 0)
	{}
}

contract WeiRelativeExpense is Expense {
	function WeiRelativeExpense(uint _percentsMul100)public 
		Expense(0, _percentsMul100, 0)
	{}
}

contract WeiAbsoluteExpenseWithPeriod is Expense { 
	function WeiAbsoluteExpenseWithPeriod(uint _neededWei, uint _periodHours) public
		Expense(_neededWei, 0, _periodHours)
	{}
}

contract WeiRelativeExpenseWithPeriod is Expense {
	function WeiRelativeExpenseWithPeriod(uint _percentsMul100, uint _periodHours) public 
		Expense(0, _percentsMul100, _periodHours)
	{}
}
