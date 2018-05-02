var FiatToken = artifacts.require('FiatToken');
var EternalStorage = artifacts.require('EternalStorage');
var name = 'Sample Fiat Token';
var symbol = 'C-USD';
var currency = 'USD';
var decimals = 2;

contract('FiatToken', function (accounts) {
  let token;
  let feeAccount = accounts[8];
  let minterAccount = accounts[9];
  let reserverAccount = accounts[7];
  let pauserAccount = accounts[6];
  let certifierAccount = accounts[5];
  let blacklisterAccount = accounts[4];
  let minterCertifier = accounts[3];

  calculateFeeAmount = function(amount) {
    return Math.floor((fee / feeBase) * amount);
  }

  checkTransferEventsWithFee = function(transfer, from, to, value, feeAmount) {
    assert.equal(transfer.logs[0].event, 'Fee');
    assert.equal(transfer.logs[0].args.from, from);
    assert.equal(transfer.logs[0].args.feeAccount, feeAccount);
    assert.equal(transfer.logs[0].args.feeAmount, feeAmount);
    assert.equal(transfer.logs[1].event, 'Transfer');
    assert.equal(transfer.logs[1].args.from, from);
    assert.equal(transfer.logs[1].args.to, to);
    assert.equal(transfer.logs[1].args.value, value);
  }

  checkTransferEvents = function(transfer, from, to, value) {
    assert.equal(transfer.logs[0].event, 'Transfer');
    assert.equal(transfer.logs[0].args.from, from);
    assert.equal(transfer.logs[0].args.to, to);
    assert.equal(transfer.logs[0].args.value, value);
  }

  mint = async function(address, amount) {
    let minting = await token.mint(amount, {from: minterAccount});
    assert.equal(minting.logs[0].event, 'Mint');
    assert.equal(minting.logs[0].args.amount, amount);
    let mintTransfer = await token.transfer(address, amount, {from: reserverAccount});
    assert.equal(mintTransfer.logs[0].event, 'Transfer');
    assert.equal(mintTransfer.logs[0].args.from, reserverAccount);
    assert.equal(mintTransfer.logs[0].args.to, address);
    assert.equal(mintTransfer.logs[0].args.value, amount);
  }

  blacklist = async function(account) {
    let blacklist = await token.blacklist(account, {from: blacklisterAccount});
    assert.equal(blacklist.logs[0].event, 'Blacklisted');
    assert.equal(blacklist.logs[0].args._account, account);
  }

  unBlacklist = async function(account) {
    let unblacklist = await token.unBlacklist(account, {from: blacklisterAccount});
    assert.equal(unblacklist.logs[0].event, 'UnBlacklisted');
    assert.equal(unblacklist.logs[0].args._account, account);
  }

  setLongDecimalFeesTransferWithFees = async function() {
    fee = 123589;
    feeBase = 1000000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 1900);
    let initialBalanceFeeAccount = await token.balanceOf(feeAccount);

    await token.approve(accounts[3], 1500);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 1500);

    let transfer = await token.transfer(accounts[3], 1000, {from: accounts[0]});

    let feeAmount = calculateFeeAmount(1000);
    checkTransferEvents(transfer, accounts[0], accounts[3], 1000, feeAmount);


    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 1900 - 1000 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 1000);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount.c[0] - initialBalanceFeeAccount.c[0], feeAmount);
  }

  sampleTransfer = async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 1900);

    await token.approve(accounts[3], 1500);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 1500);

    let transfer = await token.transfer(accounts[3], 1000, {from: accounts[0]});

    checkTransferEvents(transfer, accounts[0], accounts[3], 1000);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 1900 - 1000);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 1000);
  }

  failToMintAfterFinishMinting = async function() {
    await token.finishMinting({from: minterAccount});
    assert.equal(await token.mintingFinished(), true);
    try {
      await mint(accounts[0], 100);
      assert.fail('Minting not stopped');
    } catch (e) {}
  }

  transferFromWithFees = async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 900);
    let initialBalanceFeeAccount = await token.balanceOf(feeAccount);
    await token.approve(accounts[3], 634);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 634);

    transfer = await token.transferFrom(accounts[0], accounts[3], 534, {from: accounts[3]});

    let feeAmount = calculateFeeAmount(534);
    checkTransferEvents(transfer, accounts[0], accounts[3], 534, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0.c[0], 900 - 534 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3.c[0], 534);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount.c[0] - initialBalanceFeeAccount.c[0], feeAmount);
  }

  sampleTransferFrom = async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 900);
    await token.approve(accounts[3], 634);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 634);

    transfer = await token.transferFrom(accounts[0], accounts[3], 534, {from: accounts[3]});

    checkTransferEvents(transfer, accounts[0], accounts[3], 534);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0.c[0], 900 - 534);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3.c[0], 534);
  }

  approve = async function(to, amount, from) {
    await token.approve(to, amount, {from: from});
  }

  redeem = async function(account, amount) {
    let redeemResult = await token.redeem(amount, {from: account});
    assert.equal(redeemResult.logs[0].event, 'Redeem');
    assert.equal(redeemResult.logs[0].args.redeemedAddress, account);
    assert.equal(redeemResult.logs[0].args.amount, amount);
  }

  beforeEach(async function () {
    storage = await EternalStorage.new();
    let storageAddress = storage.address;
    token = await FiatToken.new(storageAddress, name, symbol, currency, decimals, minterAccount, pauserAccount, certifierAccount, blacklisterAccount, reserverAccount, minterCertifier);
    let tokenAddress = token.address;
    //Need to have to Hex
    await storage.setAddress(web3.sha3(web3.toHex('contract.address.') + tokenAddress.substring(2), {encoding: 'hex'}), tokenAddress);
    await storage.setBool(web3.sha3(web3.toHex('contract.storage.initialised'), {encoding: 'hex'}), true);
    //Set up initial hot wallet reserves
    initialHotWalletAmount = 100000;
    await token.mint(initialHotWalletAmount, {from: minterAccount});
  });

  it('should start with a totalSupply of 0', async function () {
    let joe = await storage.getUint(web3.sha3('totalSupply'));
    let totalSupply = await token.totalSupply();
    assert.equal(totalSupply.c[0] - initialHotWalletAmount, 0);
  });

  it('should return mintingFinished false after construction', async function () {
    let mintingFinished = await token.mintingFinished();

    assert.equal(mintingFinished, false);
  });

  it('should add multiple mints to a given address in address balance', async function () {
    await mint(accounts[0], 100);
    await mint(accounts[0], 200);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 300);
  });

  it('should add multiple mints to a given address in address balance', async function () {
    await mint(accounts[0], 100);
    await mint(accounts[0], 200);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0.c[0], 300);

  });

  it('should add multiple mints to total supply', async function () {
    let initialTotalSupply = await token.totalSupply();
    await mint(accounts[0], 100);
    await mint(accounts[0], 400);
    await mint(accounts[1], 600);

    let totalSupply = await token.totalSupply();
    assert.equal(totalSupply.c[0] - initialTotalSupply.c[0], 1100);
  });

  it('should fail to mint from a non-owner call', async function () {
     await mint(accounts[0], 400);
     try {
      await token.mint(accounts[0], 100, {from: accounts[0]});
      assert.fail();
    } catch (e) {

    } finally {
      let balance0 = await token.balanceOf(accounts[0]);
      assert.equal(balance0, 400);
    }
  });

  it('should fail to mint after call to finishMinting', async function () {
    await failToMintAfterFinishMinting();
  });

  it('should complete transferFrom', async function() {
    await sampleTransferFrom();
  });


  it('should approve', async function() {
    await approve(accounts[3], 100, accounts[2]);
    assert.equal((await token.allowance(accounts[2], accounts[3])).c[0], 100);
  });

  it('should complete sample transfer', async function() {
    await sampleTransfer();  
  });

  it('should complete transfer from non-owner', async function() {
    await mint(accounts[2], 1900);
    let transfer = await token.transfer(accounts[3], 1000, {from: accounts[2]});

    checkTransferEvents(transfer, accounts[2], accounts[3], 1000);

    let balance0 = await token.balanceOf(accounts[2]);
    assert.equal(balance0, 1900 - 1000);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 1000);
  });

  it('should set allowance and balances before and after approved transfer', async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);

    let transfer = await token.transferFrom(accounts[0], accounts[3], 50, {from: accounts[3]});

    checkTransferEvents(transfer, accounts[0], accounts[3], 50);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 450);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 50);
  });

  it('should fail on unauthorized approved transfer and not change balances', async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);

    try {
      await token.transferFrom(accounts[0], accounts[3], 50, {from: accounts[4]});
      assert.fail()
    } catch(e) {

    } finally {
      let balance0 = await token.balanceOf(accounts[0]);
      assert.equal(balance0, 500);
      let balance3 = await token.balanceOf(accounts[3]);
      assert.equal(balance3, 0);
    }
  });

  it('should fail on invalid approved transfer amount and not change balances', async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);

    try {
      await token.transferFrom(accounts[0], accounts[3], 450, {from: accounts[3]});
      assert.fail()
    } catch(e) {

    } finally {
      let balance0 = await token.balanceOf(accounts[0]);
      assert.equal(balance0, 500);
      let balance3 = await token.balanceOf(accounts[3]);
      assert.equal(balance3, 0);
    }
  });

  it('should fail on invalid transfer recipient (zero-account) and not change balances', async function() {

    await mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);

    try {
      await token.transferFrom(accounts[0], 0, 50, {from: accounts[3]});
      assert.fail()
    } catch(e) {

    } finally {
      let balance0 = await token.balanceOf(accounts[0]);
      assert.equal(balance0, 500);
    }

  });

  it('should fail on invalid transfer recipient (invalid address) and not change balances', async function() {

    await mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);

    try {
      await token.transferFrom(accounts[0], 'invalid address', 50, {from: accounts[3]});
      assert.fail()
    } catch(e) {

    } finally {
      let balance0 = await token.balanceOf(accounts[0]);
      assert.equal(balance0, 500);
    }
    
  });

  it('should test consistency of transfer(x) and approve(x) + transferFrom(x)', async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;
    let totalAmount = transferAmount;
    await mint(accounts[0], totalAmount);

    let transfer = await token.transfer(accounts[3], transferAmount);
    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, totalAmount - transferAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount);

    await token.allowance.call(accounts[1], accounts[4]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[1], totalAmount);

    await token.approve(accounts[4], transferAmount, {from: accounts[1]});
    allowed = await token.allowance.call(accounts[1], accounts[4]);
    assert.equal(allowed.c[0], transferAmount);

    transfer = await token.transferFrom(accounts[1], accounts[4], transferAmount, {from: accounts[4]});

    checkTransferEvents(transfer, accounts[1], accounts[4], transferAmount);

    let balance1 = await token.balanceOf(accounts[1]);
    assert.equal(balance0, totalAmount - transferAmount);
    let balance4 = await token.balanceOf(accounts[4]);
    assert.equal(balance3, transferAmount);
  });

  it('should pause and should not be able to transfer', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await sampleTransferFrom();
      assert.fail();
    } catch (e) {
    }
  });

  it('should pause and should not be able to transfer, then unpause and be able to transfer', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await sampleTransferFrom();
      assert.fail();
    } catch (e) {
    }

    await token.unpause({from: pauserAccount});
    assert.equal(await token.paused.call(), false);
    await sampleTransferFrom();
  });

  it('should attempt to unpause when already unpaused and fail', async function () {
    assert.equal(await token.paused.call(), false);
    try {
      await token.unpause({from: pauserAccount});
      assert.fail();
    } catch (e) {
    }
  })

  it('should pause and should not be able to transferFrom', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await sampleTransfer();
      assert.fail();
    } catch (e) {
    }
  });

  it('should pause and should not be able to approve', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await approve(accounts[2], 50, accounts[3]);
      assert.fail();
    } catch (e) {
    }
  });

  it('should pause and should not be able to mint', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await mint(accounts[2], 1900);
      assert.fail();
    } catch (e) {
    }
  });

  it('should pause and should not be able to finishMinting', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await failToMintAfterFinishMinting();
      assert.fail();
    } catch (e) {
    }
  });

  it('should try to pause with non-pauser and fail to pause', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    try {
      await token.pause({from: accounts[0]});
      assert.fail();
    } catch (e) {
    } finally {
      assert.equal(await token.paused.call(), false);
    }
  });   

  it('should pause and should not be able to finishMinting', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await failToMintAfterFinishMinting();
      assert.fail();
    } catch (e) {
    }
  });

  it('should pause and should not be able to redeem', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await redeem(accounts[2], 500);
      assert.fail();
    } catch (e) {
    }
  });

  it('should try to pause with non-pauser and fail to pause', async function () {
    await mint(accounts[2], 1900);
    assert.equal(await token.paused.call(), false);
    try {
      await token.pause({from: accounts[0]});
      assert.fail();
    } catch (e) {
    } finally {
      assert.equal(await token.paused.call(), false);
    }
  }); 

  it('should add and remove account to redeemer list', async function() {
    let addedDepositor = await token.addRedeemer(accounts[4], {from: certifierAccount});
    assert.equal(addedDepositor.logs[0].event, 'NewRedeemer');
    let removedDepositor = await token.removeRedeemer(accounts[4], {from: certifierAccount});
    assert.equal(removedDepositor.logs[0].event, 'RemovedRedeemer');
  });

  it('should fail to add and remove account to redeemer list not using the certifierAccount', async function() {
    try {
      let addedDepositor = await token.addRedeemer(accounts[4], {from: accounts[2]});
      assert.equal(addedDepositor.logs[0].event, 'NewRedeemer');
      let removedDepositor = await token.removeRedeemer(accounts[4], {from: accounts[2]});
      assert.equal(removedDepositor.logs[0].event, 'RemovedRedeemer');
      assert.fail();
    } catch (e) {

    }
  });

  it('should redeem account in redeemer list', async function() {
    await mint(accounts[2], 1900);
    let initialTotalSupply = await token.totalSupply();
    let addedDepositor = await token.addRedeemer(accounts[2], {from: certifierAccount});
    await redeem(accounts[2], 600);
    let balance = await token.balanceOf(accounts[2]);
    assert.equal(balance, 1900 - 600);
    let totalSupply = await token.totalSupply();
    assert.equal(totalSupply.c[0] + 600, initialTotalSupply.c[0]);
  });

  it('should fail to redeem account not in redeemer list', async function() {
    await mint(accounts[2], 1900);
    let initialTotalSupply = await token.totalSupply();
    try {
      await redeem(accounts[2], 600);
      assert.fail();
    } catch (e) {

    } finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance, 1900);
       let totalSupply = await token.totalSupply();
       assert.equal(totalSupply.c[0], initialTotalSupply.c[0]);
    }
  });

  it('should fail to redeem account removed from redeemer list', async function() {
    await mint(accounts[2], 1900);
    let initialTotalSupply = await token.totalSupply();
    let addedDepositor = await token.addRedeemer(accounts[2], {from: certifierAccount});
    let removedDepositor = await token.removeRedeemer(accounts[2], {from: certifierAccount});
    try {
      await redeem(accounts[2], 600);
      assert.fail();
    } catch (e) {

    } finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance, 1900);
       let totalSupply = await token.totalSupply();
       assert.equal(totalSupply.c[0], initialTotalSupply.c[0]);
    }
  });

  it('should fail to redeem more tokens than balance', async function () {
    await mint(accounts[2], 1900);
    let initialTotalSupply = await token.totalSupply();
    let addedDepositor = await token.addRedeemer(accounts[2], {from: certifierAccount});
    try {
      await redeem(accounts[2], 10000);
      assert.fail();
    } catch (e) {

    } finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance, 1900);
       let totalSupply = await token.totalSupply();
       assert.equal(totalSupply.c[0], initialTotalSupply.c[0]);
    }
  });

  it('should approve and fail to transfer more than balance', async function() {
    await mint(accounts[2], 100);
    await token.approve(accounts[1], 600, {from: accounts[2]});
    try {
      await token.transferFrom(accounts[2], accounts[1], 600, {from: accounts[1]});
      assert.fail();
    } catch (e) {

    } 
    finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance.c[0], 100);
    }
  });


  it('should blacklist and make transfer impossible', async function() {
    await mint(accounts[2], 1900);
    await blacklist(accounts[2]);
    try {
      await token.transfer(accounts[3], 600, {from: accounts[2]});
      assert.fail();
    } catch (e) {

    } finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance, 1900);
    }
  });

  it('should blacklist recipient and make transfer to recipient impossible', async function() {
    await mint(accounts[2], 1900);
    await mint(accounts[9], 1600);
    await blacklist(accounts[2]);
    try {
      await token.transfer(accounts[2], 600, {from: accounts[9]});
      assert.fail();
    } catch (e) {

    } finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance.c[0], 1900);
       balance = await token.balanceOf(accounts[9]);
       assert.equal(balance.c[0], 1600);
    }
  });

  it('should blacklist and make transferFrom impossible with the approved transferer', async function() {
    let isBlacklistedBefore = await token.isAccountBlacklisted(accounts[2])
    assert.equal(isBlacklistedBefore, false);

    await mint(accounts[2], 1900);
    await token.approve(accounts[1], 600, {from: accounts[2]});
    await blacklist(accounts[2]);
    try {
      await token.transferFrom(accounts[2], accounts[3], 600, {from: accounts[1]});
      assert.fail();
    } catch (e) {

    } 
    finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance.c[0], 1900);
    }

    let isBlacklistedAfter = await token.isAccountBlacklisted(accounts[2]);
    assert.equal(isBlacklistedAfter, true);
  });

  it('should make transferFrom impossible with the approved and blacklisted transferer', async function() {
    await mint(accounts[2], 1900);
    await token.approve(accounts[1], 600, {from: accounts[2]});
    await blacklist(accounts[1]);
    try {
      await token.transferFrom(accounts[2], accounts[3], 600, {from: accounts[1]});
      assert.fail();
    } catch (e) {
      
    } 
    finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance.c[0], 1900);
    }
  });

  it('should blacklist recipient and make transfer to recipient using transferFrom impossible', async function() {
    await mint(accounts[2], 1900);
    await token.approve(accounts[3], 600, {from: accounts[2]});
    await blacklist(accounts[3]);
    try {
      await token.transferFrom(accounts[2], accounts[3], 600, {from: accounts[2]});
      assert.fail();
    } catch (e) {
      
    } 
    finally {
       let balance = await token.balanceOf(accounts[2]);
       assert.equal(balance.c[0], 1900);
    }
  });


  it('should blacklist and make approve impossible', async function() {
    await mint(accounts[1], 1900);
    await blacklist(accounts[1]);
    try {
      await token.approve(accounts[2], 600, {from: accounts[1]});
    } catch (e) {
      
    } 
    finally {
       let approval = await token.allowance(accounts[1], accounts[2]);
       assert.equal(approval.c[0], 0);
    }
  });

  it('should make giving approval to blacklisted account impossible', async function() {
    await mint(accounts[2], 1900);
    await blacklist(accounts[1]);
    try {
      await token.approve(accounts[1], 600, {from: accounts[2]});
    } catch (e) {
      
    } 
    finally {
       let approval = await token.allowance(accounts[2], accounts[1]);
       assert.equal(approval.c[0], 0);
    }
  });

  /* Comments out increase/decrease approval tests */
  /* 

  it('should increase approval', async function() {
    await approve(accounts[3], 100, accounts[2]);
    await increaseApproval(accounts[3], 50, accounts[2]);
    assert.equal((await token.allowance(accounts[2], accounts[3])).c[0], 150);
  });

  it('should decrease approval', async function() {
    await approve(accounts[3], 100, accounts[2]);
    await decreaseApproval(accounts[3], 50, accounts[2]);
    assert.equal((await token.allowance(accounts[2], accounts[3])).c[0], 50);
  });

  it('should set long-decimal fees, approve transfer amount with fee, and complete transferFrom with fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;
    let feeAmount = calculateFeeAmount(transferAmount);
    let totalAmount = transferAmount + feeAmount;
    await mint(accounts[0], totalAmount);


    await token.approveWithFee(accounts[3], transferAmount);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], totalAmount);

    transfer = await token.transferFrom(accounts[0], accounts[3], transferAmount, {from: accounts[3]});

    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);
  });
*/
/*
  it('should set long-decimal fees, set approval amount with fee, complete transferFrom, increase approval with fees and complete transferFrom another with fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;
    let feeAmount = calculateFeeAmount(transferAmount);
    let totalAmount = transferAmount + feeAmount;
    await mint(accounts[0], totalAmount);
    console.log(totalAmount);


    await token.approveWithFee(accounts[3], transferAmount);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], totalAmount);
    transfer = await token.transferFrom(accounts[0], accounts[3], transferAmount, {from: accounts[3]});

    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);

    let transferAmountOld = transferAmount;
    let feeAmountOld = feeAmount;
    let totalAmountOld = totalAmount;

    transferAmount = 800;
    feeAmount = calculateFeeAmount(transferAmount);
    totalAmount = transferAmount + feeAmount;
    await mint(accounts[0], totalAmount);

    await token.increaseApprovalWithFee(accounts[3], transferAmount);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], totalAmount);

    transfer = await token.transferFrom(accounts[0], accounts[3], transferAmount, {from: accounts[3]});

    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount, feeAmount);

    balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);
    balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount + transferAmountOld);
    balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount + feeAmountOld);
  });

  it('should set approve transfer amount with fee, decrease approval amount with fee', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;

    await token.approveWithFee(accounts[3], transferAmount);
    await token.decreaseApprovalWithFee(accounts[3], transferAmount);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
  });

  it('should pause and should not be able to increaseApproval', async function () {
    await mint(accounts[2], 1900);
    await approve(accounts[2], 50, accounts[3]);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await increaseApproval(accounts[2], 200, accounts[3]);
      assert.fail();
    } catch (e) {
    }
  });

  it('should pause and should not be able to decreaseApproval', async function () {
    await mint(accounts[2], 1900);
    await approve(accounts[2], 50, accounts[3]);
    assert.equal(await token.paused.call(), false);
    await token.pause({from: pauserAccount});
    assert.equal(await token.paused.call(), true);

    try {
      await decreaseApproval(accounts[2], 20, accounts[3]);
      assert.fail();
    } catch (e) {
    }
  });

  it('should blacklist and make increaseApproval impossible', async function() {
    await mint(accounts[1], 1900);
    await token.approve(accounts[2], 600, {from: accounts[1]});
    await blacklist(accounts[1]);
    try {
      await token.increaseApproval(accounts[2], 600, {from: accounts[1]});
    } catch (e) {
      
    } 
    finally {
       let approval = await token.allowance(accounts[1], accounts[2]);
       assert.equal(approval.c[0], 600);
    }
  });

  it('should make giving increaseApproval to blacklisted account impossible', async function() {
    await mint(accounts[2], 1900);
    await token.approve(accounts[1], 600, {from: accounts[2]});
    await blacklist(accounts[1]);
    try {
      await token.increaseApproval(accounts[1], 600, {from: accounts[2]});
    } catch (e) {
      
    } 
    finally {
       let approval = await token.allowance(accounts[2], accounts[1]);
       assert.equal(approval.c[0], 600);
    }
  });

  it('should blacklist and make decreaseApproval impossible', async function() {
    await mint(accounts[1], 1900);
    await token.approve(accounts[2], 600, {from: accounts[1]});
    await blacklist(accounts[1]);
    try {
      await token.decreaseApproval(accounts[2], 600, {from: accounts[1]});
    } catch (e) {
      
    } 
    finally {
       let approval = await token.allowance(accounts[1], accounts[2]);
       assert.equal(approval.c[0], 600);
    }
  });

  it('should make giving decreaseApproval to blacklisted account impossible', async function() {
    await mint(accounts[2], 1900);
    await token.approve(accounts[1], 600, {from: accounts[2]});
    await blacklist(accounts[1]);
    try {
      await token.decreaseApproval(accounts[1], 600, {from: accounts[2]});
    } catch (e) {
      
    } 
    finally {
       let approval = await token.allowance(accounts[2], accounts[1]);
       assert.equal(approval.c[0], 600);
    }
  });*/

  it('should blacklist then unblacklist to make a transfer possible', async function() {
    await mint(accounts[2], 1900);
    await blacklist(accounts[2]);
    await unBlacklist(accounts[2]);
    await token.transfer(accounts[3], 600, {from: accounts[2]});
    let balance = await token.balanceOf(accounts[2]);
    assert.equal(balance.c[0], 1300);
    balance = await token.balanceOf(accounts[3]);
    assert.equal(balance.c[0], 600)
  });

  it('should fail to blacklist with non-blacklister account', async function() {
    await mint(accounts[2], 1900);
    try {
      await token.blacklist(accounts[2], {from: pauserAccount});
    } catch (e) {

    } finally {
      await token.transfer(accounts[3], 600, {from: accounts[2]});
      let balance = await token.balanceOf(accounts[2]);
      assert.equal(balance.c[0], 1300);
      balance = await token.balanceOf(accounts[3]);
      assert.equal(balance.c[0], 600)
    }
  });

  it('should fail to change the minter with a non-minterCertifier account', async function() {
    try {
      await token.updateMinter(accounts[8]);
    } catch (e) {

    } finally {
      let minter = await token.minter();
      assert.equal(minterAccount, minter);
    }
  });

  it('should change the minter and mint as well as fail to mint with the old minter', async function() {
    let update = await token.updateMinter(accounts[8], {from: minterCertifier});
    assert.equal(update.logs[0].event, 'MinterUpdate');
    assert.equal(update.logs[0].args.newMinter, accounts[8]);
    let initialBalanceReserveAccount = await token.balanceOf(reserverAccount);
    await token.mint(100, {from: accounts[8]});
    try {
      await token.mint(200, {from: minterAccount});
    } catch (e) {

    } finally {
      let minter = await token.minter();
      assert.equal(accounts[8], minter);
      let balance = await token.balanceOf(reserverAccount);
      assert.equal(balance.c[0] - initialBalanceReserveAccount.c[0], 100);
    }
  });

  it('should have correct name', async function () {
    let actual = await token.name.call();
    assert.equal(actual, name);
  });

  it('should have correct symbol', async function () {
    let actual = await token.symbol.call();
    assert.equal(actual, symbol);
  });

  it('should have correct decimals', async function () {
    let actual = await token.decimals.call();
    assert.equal(actual, decimals);
  });

  it('should have correct currency', async function () {
    let actual = await token.currency.call();
    assert.equal(actual, currency);
  });

  it('should setAddress and getAddress from storage, then deleteAddress', async function () {
    testStorage = await EternalStorage.new();
    let setterAddress = accounts[3];
    var addressHex = web3.sha3(web3.toHex('contract.address.') + setterAddress.substring(2), {encoding: 'hex'})
    
    await testStorage.setAddress(addressHex, setterAddress);
    addressGotten = await testStorage.getAddress(addressHex);
    assert.equal(addressGotten, setterAddress);

    await testStorage.deleteAddress(addressHex);
    addressAfterDeletion = await testStorage.getAddress(addressHex);
    assert.equal(addressAfterDeletion, '0x0000000000000000000000000000000000000000');
  });

  it('should setString and getString from storage, then deleteString', async function () {
    testStorage = await EternalStorage.new();
    let setterAddress = accounts[3];
    await testStorage.setAddress(web3.sha3(web3.toHex('contract.address.') + setterAddress.substring(2), {encoding: 'hex'}), setterAddress);

    await testStorage.setString('key', 'value', {from: setterAddress});
    value = await testStorage.getString('key');
    assert.equal(value, 'value');

    await testStorage.deleteString('key', {from: setterAddress});
    valueAfterDeletion = await testStorage.getString('key');
    assert.equal(valueAfterDeletion, '');
  });

  it('should setBytes and getBytes from storage, then deleteBytes', async function () {
    testStorage = await EternalStorage.new();
    let setterAddress = accounts[3];
    await testStorage.setAddress(web3.sha3(web3.toHex('contract.address.') + setterAddress.substring(2), {encoding: 'hex'}), setterAddress);

    await testStorage.setBytes('key', 'value', {from: setterAddress});
    value = await testStorage.getBytes('key');
    assert.equal(value, web3.toHex(value));

    await testStorage.deleteBytes('key', {from: setterAddress});
    value = await testStorage.getBytes('key');
    assert.equal(value, '0x');
  })

  it('should setInt and getInt from storage, then deleteInt', async function () {
    testStorage = await EternalStorage.new();
    let setterAddress = accounts[3];
    await testStorage.setAddress(web3.sha3(web3.toHex('contract.address.') + setterAddress.substring(2), {encoding: 'hex'}), setterAddress);

    await testStorage.setInt('key', 1, {from: setterAddress});
    value = await testStorage.getInt('key');
    assert.equal(value, 1);

    await testStorage.deleteInt('key', {from: setterAddress});
    value = await testStorage.getInt('key');
    assert.equal(value.toNumber(), 0);
  })

  it('should setUint and getUint from storage, then deleteUint', async function () {
    testStorage = await EternalStorage.new();
    let setterAddress = accounts[3];
    await testStorage.setAddress(web3.sha3(web3.toHex('contract.address.') + setterAddress.substring(2), {encoding: 'hex'}), setterAddress);

    await testStorage.setUint('key', 1, {from: setterAddress});
    value = await testStorage.getUint('key');
    assert.equal(value.toNumber(), 1);

    await testStorage.deleteUint('key', {from: setterAddress});
    valueAfterDeletion = await testStorage.getUint('key');
    assert.equal(valueAfterDeletion.toNumber(), 0);
  })

  it('should setBool and getBool from storage, then deleteBool', async function () {
    testStorage = await EternalStorage.new();
    let setterAddress = accounts[3];
    await testStorage.setAddress(web3.sha3(web3.toHex('contract.address.') + setterAddress.substring(2), {encoding: 'hex'}), setterAddress);

    await testStorage.setBool('key', true, {from: setterAddress});
    value = await testStorage.getBool('key');
    assert.equal(value, true);

    await testStorage.deleteBool('key', {from: setterAddress});
    valueAfterDeletion = await testStorage.getBool('key');
    assert.equal(valueAfterDeletion, false)
  })

  it('should disallow owner from setting storage after deployment', async function () {
    try {
      await storage.setString('key', 'value');
      assert.fail();
    } catch (e) {}
  })

  it('should disallow an address not included in addressStorage from setting storage after deployment', async function () {
    let disallowedSender = accounts[5];
    try {
      await storage.setString('key', 'value', {from: disallowedSender});
      assert.fail();
    } catch (e) {}
  })

/* Comments out tests with fees */
/*
  var fee = 25;
  var feeBase = 1000;

  it('should set fees and complete transferFrom with fees', async function() {
    await sampleTransferFrom();
  });

  it('should set long-decimal fees and complete transferFrom with fees', async function() {
    await sampleTransferFrom();
  });

  it('should set fees and and fail to complete transferFrom with insufficient balance to cover fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 900);
    let initialBalanceFeeAccount = await token.balanceOf(feeAccount);
    await token.approve(accounts[3], 895);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 895);
    try {
        transfer = await token.transferFrom(accounts[0], accounts[3], 895, {from: accounts[3]});
        assert.fail()
      } catch(e) {

      } finally {
        let balance0 = await token.balanceOf(accounts[0]);
        assert.equal(balance0, 900);
        let balance3 = await token.balanceOf(accounts[3]);
        assert.equal(balance3, 0);
        let balanceFeeAccount = await token.balanceOf(feeAccount);
        assert.equal(balanceFeeAccount.c[0] - initialBalanceFeeAccount.c[0], 0);
      }
  });

  it('should set long-decimal fees and complete transfer with fees', async function() {
    await sampleTransfer();  
  });

  it('should set long-decimal fees and complete transfer with fees from non-owner', async function() {
    fee = 123589;
    feeBase = 1000000;
    await token.updateTransferFee(fee, feeBase);
    await mint(accounts[2], 1900);
    let initialBalanceFeeAccount = await token.balanceOf(feeAccount);

    let transfer = await token.transfer(accounts[3], 1000, {from: accounts[2]});

    let feeAmount = calculateFeeAmount(1000);
    checkTransferEvents(transfer, accounts[2], accounts[3], 1000, feeAmount);

    let balance0 = await token.balanceOf(accounts[2]);
    assert.equal(balance0, 1900 - 1000 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 1000);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount.c[0] - initialBalanceFeeAccount.c[0], feeAmount);
  });

  it('should set allowance and balances before and after approved transfer', async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);
    let initialBalanceFeeAccount = await token.balanceOf(feeAccount);

    let transfer = await token.transferFrom(accounts[0], accounts[3], 50, {from: accounts[3]});

    let feeAmount = calculateFeeAmount(50);
    checkTransferEvents(transfer, accounts[0], accounts[3], 50, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 450 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 50);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount.c[0] - initialBalanceFeeAccount, feeAmount);
  });

  it('should test consistency of transfer(x) and approve(x) + transferFrom(x) with fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;
    let feeAmount = calculateFeeAmount(transferAmount);
    let totalAmount = transferAmount + feeAmount;
    await mint(accounts[0], totalAmount);
    let initialBalanceFeeAccount = await token.balanceOf(feeAccount);

    let transfer = await token.transfer(accounts[3], transferAmount);
    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, totalAmount - transferAmount - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount - initialBalanceFeeAccount, feeAmount);

    await token.allowance.call(accounts[1], accounts[4]);
    assert.equal(allowed.c[0], 0);
    await mint(accounts[1], totalAmount);
    initialBalanceFeeAccount = await token.balanceOf(feeAccount);

    await token.approve(accounts[4], transferAmount, {from: accounts[1]});
    allowed = await token.allowance.call(accounts[1], accounts[4]);
    assert.equal(allowed.c[0], transferAmount);

    transfer = await token.transferFrom(accounts[1], accounts[4], transferAmount, {from: accounts[4]});

    checkTransferEvents(transfer, accounts[1], accounts[4], transferAmount, feeAmount);

    let balance1 = await token.balanceOf(accounts[1]);
    assert.equal(balance0, totalAmount - transferAmount - feeAmount);
    let balance4 = await token.balanceOf(accounts[4]);
    assert.equal(balance3, transferAmount);
    let balanceFeeAccountNew = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccountNew.c[0] - initialBalanceFeeAccount.c[0], feeAmount);
  });

  it('should blacklist then unblacklist to make a transfer possible', async function() {
    await mint(accounts[2], 1900);
    await blacklist(accounts[2]);
    await unBlacklist(accounts[2]);
    await token.transfer(accounts[3], 600, {from: accounts[2]});
    let balance = await token.balanceOf(accounts[2]);
    assert.equal(balance.c[0], 1300 - fee);
    balance = await token.balanceOf(accounts[3]);
    assert.equal(balance.c[0], 600)
  });

  it('should fail to blacklist with non-blacklister account', async function() {
    await mint(accounts[2], 1900);
    try {
      await token.blacklist(accounts[2], {from: pauserAccount});
    } catch (e) {

    } finally {
      await token.transfer(accounts[3], 600, {from: accounts[2]});
      let fee = calculateFeeAmount(600);
      let balance = await token.balanceOf(accounts[2]);
      assert.equal(balance.c[0], 1300 - fee);
      balance = await token.balanceOf(accounts[3]);
      assert.equal(balance.c[0], 600)
    }
  });
*/

});
