pragma solidity ^0.4.15;

import "./IMoneyflow.sol";

import "./ether/WeiExpense.sol";

import "../utils/GenericCaller.sol";

// TODO: add tests!
contract MoneyflowAuto is GenericCaller {
	IMoneyflow mf;

	constructor(IDaoBase _mc, IMoneyflow _mf)public 
		GenericCaller(_mc)	
	{
		mf = _mf;
	}

	/*
	// this is moved to Scheme!

	function addNewTaskAuto(WeiAbsoluteExpense _wt) public returns(address voteOut){
		bytes32[] memory params = new bytes32[](1);
		params[0] = bytes32(address(_wt));

		return doAction("addNewTask", mf, msg.sender,"addNewTaskGeneric(bytes32[])",params);
	}
   */

	function setRootWeiReceiverAuto(address _wt) public returns(address voteOut){
		bytes32[] memory params = new bytes32[](1);
		params[0] = bytes32(_wt);

		return doAction("setRootWeiReceiver", mf, msg.sender,"setRootWeiReceiverGeneric(bytes32[])",params);
	}

	function withdrawDonationsToAuto(address _wt) public returns(address voteOut){
		bytes32[] memory params = new bytes32[](1);
		params[0] = bytes32(_wt);

		return doAction("withdrawDonationsTo", mf, msg.sender,"withdrawDonationsToGeneric(bytes32[])",params);
	}
}
