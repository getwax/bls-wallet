import BlsSigner from "../clients/src/BlsProvider";
import BlsProvider from "../clients/src/BlsProvider"

// describe("BlsProvider tests", () => {
//   let aggregatorUrl;
//   let blsProvider: BlsProvider;
//   let blsSigner: BlsSigner;
  
//   beforeEach(() => {
//     aggregatorUrl = "";
//     blsProvider = new BlsProvider(aggregatorUrl);
//     blsSigner = blsProvider.getSigner();
//   })

//   it("'call' executes a transaction successfully", async () => {
//     // Arrange

//     // Act
    
//     // Assert

//   });

//   it("'estimateGas' returns an estimate for the amount of gas required in a transaction successfully", async () => {
//     // Arrange

//     // Act

//     // Assert

//   });

//   it("'getTransaction' returns the transaction with hash", async () => {
//     // Arrange
//     // Act
//     // Assert
//   });

//   it("'getTransactionReceipt' returns the transaction receipt given correct hash", async () => {
//     // Arrange

//     // Act

//     // Assert

//   });

//   it("'sendTransaction' sends a transaction successfully", async () => {
//     // Arrange
//     // const unsignedTransaction = {
//     //   to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
//     //   gasPrice: 9000000000,
//     //   gasLimit: 21000,
//     //   chainId: 5,
//     //   value: 1,
//     // };
//     const unsignedTransaction = {}
//     const signedTransaction = await blsSigner.signTransaction(
//       unsignedTransaction,
//     );

//     // Act & Assert
//     const transaction = await blsProvider.sendTransaction(signedTransaction);
//     await transaction.wait();
//   });

//   // TODO: Update "Mined" terminology
//   it("'waitForTransaction' resolves once transactionHash is mined", async () => {
//     // Arrange

//     // Act

//     // Assert

//   });
// });