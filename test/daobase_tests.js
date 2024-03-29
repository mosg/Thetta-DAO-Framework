var DaoBaseWithUnpackers = artifacts.require("./DaoBaseWithUnpackers");
var StdDaoToken = artifacts.require("./StdDaoToken");
var DaoStorage = artifacts.require("./DaoStorage");
var AutoDaoBaseActionCaller = artifacts.require("./AutoDaoBaseActionCaller");
var DaoBaseWithUnpackers = artifacts.require("./DaoBaseWithUnpackers");

// to check how upgrade works with IDaoBase clients
var MoneyFlow = artifacts.require("./MoneyFlow");
var IWeiReceiver = artifacts.require("./IWeiReceiver");

var Voting = artifacts.require("./Voting");
var IProposal = artifacts.require("./IProposal");

var CheckExceptions = require('./utils/checkexceptions');

global.contract('DaoBase', (accounts) => {
	let token;
	let store;
	let daoBase;

	const creator = accounts[0];
	const employee1 = accounts[1];
	const employee2 = accounts[2];
	const outsider = accounts[3];

	global.beforeEach(async() => {
	
		token = await StdDaoToken.new("StdToken","STDT",18,{from: creator});
		await token.mint(creator, 1000);
		store = await DaoStorage.new(token.address,{gas: 10000000, from: creator});

		daoBase = await DaoBaseWithUnpackers.new(store.address,{gas: 10000000, from: creator});

		{
			// add creator as first employee	
			await store.addGroup("Employees");
			await store.addGroupMember("Employees", creator);

			// manually setup the Default organization permissions
			await store.allowActionByAnyMemberOfGroup("addNewProposal","Employees");
			await store.allowActionByAnyMemberOfGroup("startTask","Employees");
			await store.allowActionByAnyMemberOfGroup("startBounty","Employees");
			await store.allowActionByAnyMemberOfGroup("modifyMoneyscheme","Employees");

			// this is a list of actions that require voting
			await store.allowActionByVoting("manageGroups", token.address);
			await store.allowActionByVoting("addNewTask", token.address);
			await store.allowActionByVoting("issueTokens", token.address);
			await store.allowActionByVoting("upgradeDao", token.address);
		}

		// do not forget to transfer ownership
		await token.transferOwnership(daoBase.address);
		await store.transferOwnership(daoBase.address);
	});

	global.it('should set everything correctly',async() => {
		const isMember = await store.isGroupMember("Employees", creator);
		global.assert.equal(isMember,true,'Permission should be set correctly');

		const isMember2 = await store.isGroupMember("Employees", employee1);
		global.assert.equal(isMember2,false,'Permission should be set correctly');

		///
		const isCan = await store.isCanDoByGroupMember("addNewProposal", "Employees");
		global.assert.equal(isCan,true,'Permission should be set correctly');

		const isMajority = await daoBase.isInMajority(creator, token.address);
		global.assert.strictEqual(isMajority,true,'Creator should be in majority');

		const isMajority2 = await daoBase.isInMajority(employee1, token.address);
		global.assert.strictEqual(isMajority2,false,'Employee should not be in majority');
	});

	global.it('should return correct permissions for an outsider',async() => {
		const isCanDo1 = await daoBase.isCanDoAction(outsider,"addNewProposal");
		const isCanDo2 = await daoBase.isCanDoAction(outsider,"startTask");
		const isCanDo3 = await daoBase.isCanDoAction(outsider,"startBounty");
		global.assert.strictEqual(isCanDo1,false,'Outsider should not be able to do that ');
		global.assert.strictEqual(isCanDo2,false,'Outsider should not be able to do that ');
		global.assert.strictEqual(isCanDo3,false,'Outsider should not be able to do that ');

		const isCanDo4 = await daoBase.isCanDoAction(outsider,"manageGroups");
		const isCanDo5 = await daoBase.isCanDoAction(outsider,"addNewTask");
		const isCanDo6 = await daoBase.isCanDoAction(outsider,"issueTokens");
		global.assert.strictEqual(isCanDo4,false,'Outsider should not be able to do that because he is in majority');
		global.assert.strictEqual(isCanDo5,false,'Outsider should not be able to do that because he is in majority');
		global.assert.strictEqual(isCanDo6,false,'Outsider should not be able to do that because he is in majority');
	});

	global.it('should return correct permissions for creator',async() => {
		const isCanDo1 = await daoBase.isCanDoAction(creator,"addNewProposal");
		const isCanDo2 = await daoBase.isCanDoAction(creator,"startTask");
		const isCanDo3 = await daoBase.isCanDoAction(creator,"startBounty");
		global.assert.strictEqual(isCanDo1,true,'Creator should be able to do that ');
		global.assert.strictEqual(isCanDo2,true,'Creator should be able to do that ');
		global.assert.strictEqual(isCanDo3,true,'Creator should be able to do that ');

		const isCanDo4 = await daoBase.isCanDoAction(creator,"manageGroups");
		const isCanDo5 = await daoBase.isCanDoAction(creator,"addNewTask");
		const isCanDo6 = await daoBase.isCanDoAction(creator,"issueTokens");
		global.assert.strictEqual(isCanDo4,true,'Creator should be able to do that because he is in majority');
		global.assert.strictEqual(isCanDo5,true,'Creator should be able to do that because he is in majority');
		global.assert.strictEqual(isCanDo6,true,'Creator should be able to do that because he is in majority');
	});

	global.it('should not add new vote if not employee',async() => {
		// employee1 is still not added to DaoBase as an employee
		let newProposal = 0x123;
		await CheckExceptions.checkContractThrows(daoBase.addNewProposal.sendTransaction,
			[newProposal, { from: employee1}],
			'Should not add new proposal because employee1 has no permission');
	});

	global.it('should issue tokens to employee1 and employee2',async() => {
		await daoBase.issueTokens(employee1,1000,{from: creator});
		await daoBase.issueTokens(employee2,1000,{from: creator});

		const isMajority1 = await daoBase.isInMajority(creator, token.address);
		global.assert.strictEqual(isMajority1,false,'Creator should NOT be in majority now');

		const isMajority2 = await daoBase.isInMajority(employee1, token.address);
		global.assert.strictEqual(isMajority2,false,'employee1 is now in majority');

		const isMajority3 = await daoBase.isInMajority(employee2, token.address);
		global.assert.strictEqual(isMajority3,false,'employee1 is now in majority');

		// CHECK this .at syntax!!!
		const balance1 = await token.balanceOf(creator);
		global.assert.equal(balance1,1000,'initial balance');

		const balance2 = await token.balanceOf(employee1);
		global.assert.equal(balance2,1000,'employee1 balance');
		
		const balance3 = await token.balanceOf(employee2);
		global.assert.equal(balance3,1000,'employee2 balance');
	});

	global.it('should be able to upgrade',async() => {
		let token = await StdDaoToken.new("StdToken","STDT",18,{from: creator});
		await token.mint(creator, 1000);
		let store = await DaoStorage.new(token.address,{gas: 10000000, from: creator});

		let daoBase = await DaoBaseWithUnpackers.new(store.address,{gas: 10000000, from: creator});

		// one client of the IDaoBase (to test how upgrade works with it)
		let moneyflowInstance = await MoneyFlow.new(daoBase.address,{from: creator});

		await store.addGroup("Employees");
		await store.addGroupMember("Employees", creator);

		await store.allowActionByAnyMemberOfGroup("addNewProposal","Employees");
		await store.allowActionByAnyMemberOfGroup("manageGroups","Employees");
		await store.allowActionByAnyMemberOfGroup("issueTokens","Employees");
		await store.allowActionByAnyMemberOfGroup("upgradeDao","Employees");

		// THIS permission IS VERY DANGEROUS!!!
		// allow creator to get donations from the Moneyflow 
		await store.allowActionByAddress("withdrawDonations", creator);

		// do not forget to transfer ownership
		await token.transferOwnership(daoBase.address);
		await store.transferOwnership(daoBase.address);

		// UPGRADE!
		let daoBaseNew = await DaoBaseWithUnpackers.new(store.address,{gas: 10000000, from: creator});
		await daoBase.upgradeDaoContract(daoBaseNew.address, {gas: 10000000, from: creator});

		await daoBaseNew.issueTokens(employee1,1000,{from: creator});

		// check employee1 balance
		const balance1 = await token.balanceOf(employee1);
		global.assert.equal(balance1,1000,'balance should be updated');

		await daoBaseNew.addGroupMember("Employees", employee1,{from: creator});
		const isEmployeeAdded = await daoBaseNew.isGroupMember("Employees",employee1);
		global.assert.strictEqual(isEmployeeAdded,true,'employee1 should be added as the company`s employee');

		await CheckExceptions.checkContractThrows(daoBase.addGroupMember,
			["Employees", employee2, { from: creator}],
			'Should not add new employee to old MC');

		await CheckExceptions.checkContractThrows(daoBase.issueTokens,
			[employee2, { from: creator}],
			'Should not issue tokens through MC');

		// now try to withdraw donations with new mc
		const money = 1000000000;
		const dea = await moneyflowInstance.getDonationEndpoint(); 
		const donationEndpoint = await IWeiReceiver.at(dea);
		await donationEndpoint.processFunds(money, { from: creator, value: money, gasPrice: 0});

		let donationBalance = await web3.eth.getBalance(donationEndpoint.address);
		global.assert.equal(donationBalance.toNumber(),money, 'all money at donation point now');

		// withdraw
		let outBalance = await web3.eth.getBalance(outsider);
		await moneyflowInstance.withdrawDonationsTo(outsider,{from:creator, gas:100000, gasPrice: 0});

		let outBalance2 = await web3.eth.getBalance(outsider);
		let balanceDelta = outBalance2.toNumber() - outBalance.toNumber();

		// TODO: fix that!!!
		// TODO: why not working? 
		//global.assert.equal(balanceDelta, money, 'all donations now on outsiders`s balance');

		let donationBalance2 = await web3.eth.getBalance(donationEndpoint.address);
		global.assert.equal(donationBalance2.toNumber(),0, 'all donations now on creator`s balance');
	});
});

