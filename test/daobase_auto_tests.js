var DaoBaseWithUnpackers = artifacts.require("./DaoBaseWithUnpackers");
var StdDaoToken = artifacts.require("./StdDaoToken");
var DaoStorage = artifacts.require("./DaoStorage");

var DaoBaseAuto = artifacts.require("./DaoBaseAuto");

var Voting = artifacts.require("./Voting");
var IProposal = artifacts.require("./IProposal");

var CheckExceptions = require('./utils/checkexceptions');

function KECCAK256 (x){
	return web3.sha3(x);
}

global.contract('DaoBaseAuto', (accounts) => {
	const creator = accounts[0];
	const employee1 = accounts[1];
	const employee2 = accounts[2];
	const employee3 = accounts[3];
	const outsider = accounts[4];
	const output = accounts[5]; 

	let money = web3.toWei(0.001, "ether");

	let token;
	let daoBase;
	let store;
	let aacInstance;

	global.beforeEach(async() => {
		token = await StdDaoToken.new("StdToken","STDT",18,{from: creator});
		await token.mint(creator, 1000);
		await token.mint(employee1, 600);
		await token.mint(employee2, 600);
		await token.mint(employee3, 600);

		store = await DaoStorage.new([token.address],{gas: 10000000, from: creator});
		daoBase = await DaoBaseWithUnpackers.new(store.address,{gas: 10000000, from: creator});
		aacInstance = await DaoBaseAuto.new(daoBase.address, {from: creator});

		///////////////////////////////////////////////////
		// SEE THIS? set voting type for the action!
		const VOTING_TYPE_1P1V = 1;
		const VOTING_TYPE_SIMPLE_TOKEN = 2;
		await aacInstance.setVotingParams("issueTokens", VOTING_TYPE_1P1V, (24 * 60), "Employees", 50, 50, 0);
		await aacInstance.setVotingParams("upgradeDaoContract", VOTING_TYPE_1P1V, (24 * 60), "Employees", 50, 50, 0);

		// add creator as first employee	
		await store.addGroupMember(KECCAK256("Employees"), creator);
		await store.allowActionByAddress(KECCAK256("manageGroups"),creator);

		// do not forget to transfer ownership
		await token.transferOwnership(daoBase.address);
		await store.transferOwnership(daoBase.address);
	});
	
	global.it('should not automatically create proposal because AAC has no rights',async() => {
		// Set permissions:

		await daoBase.allowActionByAnyMemberOfGroup("addNewProposal","Employees");

		await daoBase.allowActionByVoting("manageGroups", token.address);
		await daoBase.allowActionByVoting("issueTokens", token.address);

		// THIS IS REQUIRED because issueTokensAuto() will add new proposal (voting)
		// because of this AAC can't add new proposal!
		// 
		//await daoBase.allowActionByAddress("addNewProposal", aacInstance.address);

		//////
		const proposalsCount1 = await daoBase.getProposalsCount();
		global.assert.equal(proposalsCount1,0,'No proposals should be added');

		// add new employee1
		await daoBase.addGroupMember("Employees",employee1,{from: creator});
		const isEmployeeAdded = await daoBase.isGroupMember("Employees", employee1);
		global.assert.strictEqual(isEmployeeAdded,true,'employee1 should be added as the company`s employee');

		// new proposal should NOT be added 
		await CheckExceptions.checkContractThrows(aacInstance.issueTokensAuto.sendTransaction,
			[token.address,employee1,1000,{ from: employee1}],
			'Should not be able to issue tokens AND add new proposal');

		const proposalsCount2 = await daoBase.getProposalsCount();
		global.assert.equal(proposalsCount2,0,'No new proposal should be added'); 
	});

	global.it('should not issue tokens automatically because issueTokens cant be called even with voting',async() => {
		await daoBase.allowActionByAnyMemberOfGroup("addNewProposal","Employees");
		await daoBase.allowActionByVoting("manageGroups", token.address);

		// SEE this -> this permissions is commented! So even if AAC has rights to add proposal, 
		// the proposal will never be finished 
		// await daoBase.allowActionByVoting("issueTokens", token.address);

		// THIS IS REQUIRED because issueTokensAuto() will add new proposal (voting)
		await daoBase.allowActionByAddress("addNewProposal", aacInstance.address);
		// these actions required if AAC will call this actions DIRECTLY (without voting)
		await daoBase.allowActionByAddress("manageGroups", aacInstance.address);
		await daoBase.allowActionByAddress("manageGroups", creator);
		await daoBase.allowActionByAddress("issueTokens", aacInstance.address);
		await daoBase.allowActionByAddress("upgradeDaoContract", aacInstance.address);

		// even creator cant issue token directly!
		await CheckExceptions.checkContractThrows(daoBase.issueTokens.sendTransaction,
			[employee1, 1500 ,{ from: creator}],
			'Even creator cant issue tokens');

		const proposalsCount1 = await daoBase.getProposalsCount();
		global.assert.equal(proposalsCount1,0,'No proposals should be added');

		// add new employee1
		await daoBase.addGroupMember("Employees",employee1,{from: creator});
		await daoBase.addGroupMember("Employees",employee2,{from: creator});
		await daoBase.addGroupMember("Employees",employee3,{from: creator});

		const isEmployeeAdded = await daoBase.isGroupMember("Employees",employee1);
		global.assert.strictEqual(isEmployeeAdded,true,'employee1 should be added as the company`s employee');

		// employee1 is NOT in the majority
		const isCanDo1 = await daoBase.isCanDoAction(employee1,"issueTokens");
		global.assert.strictEqual(isCanDo1,false,'employee1 is NOT in the majority, so can issue token only with voting');
		const isCanDo2 = await daoBase.isCanDoAction(employee1,"addNewProposal");
		global.assert.strictEqual(isCanDo2,true,'employee1 can add new vote');

		const balance1 = await token.balanceOf(employee1);
		global.assert.notEqual(balance1.toNumber(),1000,'employee1 balance is 1000');

		const isCanDo3 = await daoBase.isCanDoAction(aacInstance.address,"issueTokens");
		global.assert.strictEqual(isCanDo3,true,'aacInstance can issue tokens');
		const isCanDo4 = await daoBase.isCanDoAction(aacInstance.address,"addNewProposal");
		global.assert.strictEqual(isCanDo4,true,'aacInstance can addNewProposal');

		// new proposal should be added 
		await aacInstance.issueTokensAuto(token.address,employee1,1200,{from: employee1, gas:10000000, gasPrice:0});

		// STOP!!!
		//global.assert.equal(0,1,'STOP'); 

		const proposalsCount2 = await daoBase.getProposalsCount();
		global.assert.equal(proposalsCount2,1,'New proposal should be added'); 

		// // check the voting data
		const pa = await daoBase.getProposalAtIndex(0);
		const proposal = await IProposal.at(pa);
		const votingAddress = await proposal.getVoting();
		const voting = await Voting.at(votingAddress);

		const r1 = await voting.getFinalResults();
		global.assert.equal(r1[0],1,'yes');			// 1 already voted (who started the voting)
		global.assert.equal(r1[1],0,'no');
		global.assert.equal(r1[2],1,'total');

		global.assert.strictEqual(await voting.isFinished(),false,'Voting is still not finished');
		global.assert.strictEqual(await voting.isYes(),false,'Voting is still not finished');

		// already voted!
		await CheckExceptions.checkContractThrows(voting.vote.sendTransaction,
		 	[true,0,{ from: employee1}],
		 	'dont vote again!');

		// vote by employee 2
		await voting.vote(true,0,{from:employee2});

		const r2 = await voting.getFinalResults();
		global.assert.equal(r2[0],2,'yes');			// 1 already voted (who started the voting)
		global.assert.equal(r2[1],0,'no');
		global.assert.equal(r2[2],2,'total');

		// vote by employee 3
		await voting.vote(true,0,{from:employee3});

		// get voting results again
		global.assert.strictEqual(await voting.isFinished(),true,'Voting should be finished');
		global.assert.strictEqual(await voting.isYes(),true,'Voting is finished');
		
		const balance2 = await token.balanceOf(employee1);
		global.assert.notEqual(balance2.toNumber(),1000,'employee1 balance should not be updated');
	});

	global.it('should automatically create proposal and 1P1V voting to issue more tokens',async() => {
		await daoBase.allowActionByAnyMemberOfGroup("addNewProposal","Employees");

		await daoBase.allowActionByVoting("manageGroups", token.address);
		await daoBase.allowActionByVoting("issueTokens", token.address);

		// THIS IS REQUIRED because issueTokensAuto() will add new proposal (voting)
		await daoBase.allowActionByAddress("addNewProposal", aacInstance.address);
		// these actions required if AAC will call this actions DIRECTLY (without voting)
		await daoBase.allowActionByAddress("manageGroups", aacInstance.address);
		await daoBase.allowActionByAddress("issueTokens", aacInstance.address);
		await daoBase.allowActionByAddress("upgradeDaoContract", aacInstance.address);

		const proposalsCount1 = await daoBase.getProposalsCount();
		global.assert.equal(proposalsCount1,0,'No proposals should be added');

		// add new employee1
		await daoBase.addGroupMember("Employees",employee1,{from: creator});
		const isEmployeeAdded = await daoBase.isGroupMember("Employees",employee1);
		global.assert.strictEqual(isEmployeeAdded,true,'employee1 should be added as the company`s employee');

		await daoBase.addGroupMember("Employees",employee2,{from: creator});

		// employee1 is NOT in the majority
		const isCanDo1 = await daoBase.isCanDoAction(employee1,"issueTokens");
		global.assert.strictEqual(isCanDo1,false,'employee1 is NOT in the majority, so can issue token only with voting');
		const isCanDo2 = await daoBase.isCanDoAction(employee1,"addNewProposal");
		global.assert.strictEqual(isCanDo2,true,'employee1 can add new vote');

		// new proposal should be added 
		await aacInstance.issueTokensAuto(token.address,employee1,1000,{from: employee1});
		const proposalsCount2 = await daoBase.getProposalsCount();
		global.assert.equal(proposalsCount2,1,'New proposal should be added'); 

		// check the voting data
		const pa = await daoBase.getProposalAtIndex(0);
		const proposal = await IProposal.at(pa);
		const votingAddress = await proposal.getVoting();
		const voting = await Voting.at(votingAddress);
		global.assert.strictEqual(await voting.isFinished(),false,'Voting is still not finished');
		global.assert.strictEqual(await voting.isYes(),false,'Voting is still not finished');

		const r = await voting.getFinalResults();
		global.assert.equal(r[0],1,'yes');			// 1 already voted (who started the voting)
		global.assert.equal(r[1],0,'no');
		global.assert.equal(r[2],1,'total');
		
		const balance1 = await token.balanceOf(employee1);
		global.assert.strictEqual(balance1.toNumber(),600,'initial employee1 balance');

		// should execute the action (issue tokens)!
		await voting.vote(true,0,{from:employee2});

		const r2 = await voting.getFinalResults();
		global.assert.equal(r2[0],2,'yes');			// 1 already voted (who started the voting)
		global.assert.equal(r2[1],0,'no');
		global.assert.equal(r2[2],2,'total');
		
		// get voting results again
		global.assert.strictEqual(await voting.isFinished(),true,'Voting is finished now');
		global.assert.strictEqual(await voting.isYes(),true,'Voting result is yes!');

		const balance2 = await token.balanceOf(employee1);
		global.assert.strictEqual(balance2.toNumber(),1600,'employee1 balance should be updated');

		// should not call vote again 
		await CheckExceptions.checkContractThrows(voting.vote.sendTransaction,
			[true, 0, { from: employee1}],
			'Should not call action again');
	});

	global.it('should be able to upgrade with AAC',async() => {
		await daoBase.allowActionByAddress("issueTokens", creator);
		await daoBase.issueTokens(token.address,employee1, 1000);
		await daoBase.issueTokens(token.address,employee2, 1000);

		await daoBase.addGroupMember("Employees", employee1);
		await daoBase.addGroupMember("Employees", employee2);

		await daoBase.allowActionByVoting("upgradeDaoContract", token.address);

		// THIS IS REQUIRED because issueTokensAuto() will add new proposal (voting)
		await daoBase.allowActionByAddress("addNewProposal", aacInstance.address);
		// these actions required if AAC will call this actions DIRECTLY (without voting)
		await daoBase.allowActionByAddress("manageGroups", aacInstance.address);
		await daoBase.allowActionByAddress("addNewTask", aacInstance.address);
		await daoBase.allowActionByAddress("issueTokens", aacInstance.address);
		await daoBase.allowActionByAddress("upgradeDaoContract", aacInstance.address);

		// should be able to upgrde microcompany directly without voting (creator is in majority!)
		let daoBaseNew = await DaoBaseWithUnpackers.new(store.address,{gas: 10000000, from: creator});
		await aacInstance.upgradeDaoContractAuto(daoBaseNew.address,{from: employee1});

		const pa = await daoBase.getProposalAtIndex(0);
		const proposal = await IProposal.at(pa);
		const votingAddress = await proposal.getVoting();
		const voting = await Voting.at(votingAddress);
		global.assert.strictEqual(await voting.isFinished(),false,'Voting is still not finished');
		global.assert.strictEqual(await voting.isYes(),false,'Voting is still not finished');

		await voting.vote(true,0,{from:creator});
		
		const r2 = await voting.getFinalResults();
		global.assert.equal(r2[0].toNumber(),2,'yes');			// 1 already voted (who started the voting)
		global.assert.equal(r2[1].toNumber(),0,'no');
		global.assert.equal(r2[2].toNumber(),2,'total');

		// get voting results again
		global.assert.strictEqual(await voting.isFinished(),true,'Voting is still not finished');
		global.assert.strictEqual(await voting.isYes(),true,'Voting is still not finished');
	});

	global.it('should create SimpleTokenVoting to issue more tokens',async() => {
		await daoBase.allowActionByAnyMemberOfGroup("addNewProposal","Employees");
		await daoBase.allowActionByVoting("manageGroups", token.address);
		await daoBase.allowActionByVoting("issueTokens", token.address);

		// THIS IS REQUIRED because issueTokensAuto() will add new proposal (voting)
		await daoBase.allowActionByAddress("addNewProposal", aacInstance.address);
		// these actions required if AAC will call this actions DIRECTLY (without voting)
		await daoBase.allowActionByAddress("manageGroups", aacInstance.address);
		await daoBase.allowActionByAddress("issueTokens", aacInstance.address);
		await daoBase.allowActionByAddress("upgradeDaoContract", aacInstance.address);

		const proposalsCount1 = await daoBase.getProposalsCount();
		global.assert.equal(proposalsCount1,0,'No proposals should be added');

		// add new employee1
		await daoBase.addGroupMember("Employees",employee1,{from: creator});
		const isEmployeeAdded = await daoBase.isGroupMember("Employees",employee1);
		global.assert.strictEqual(isEmployeeAdded,true,'employee1 should be added as the company`s employee');

		// employee1 is NOT in the majority
		const isCanDo1 = await daoBase.isCanDoAction(employee1,"issueTokens");
		global.assert.strictEqual(isCanDo1,false,'employee1 is NOT in the majority, so can issue token only with voting');
		const isCanDo2 = await daoBase.isCanDoAction(employee1,"addNewProposal");
		global.assert.strictEqual(isCanDo2,true,'employee1 can add new vote');

		// new proposal should be added 
		await aacInstance.issueTokensAuto(token.address,employee1,1000,{from: employee1});
		const proposalsCount2 = await daoBase.getProposalsCount();
		global.assert.equal(proposalsCount2,1,'New proposal should be added'); 
	});
});
