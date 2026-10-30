# blockchain.py
import os, json
from functools import lru_cache
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

# -----------------------------
# RPC selection (priority: QUICKNODE > ALCHEMY_API_URL > ALCHEMY_API_KEY)
# -----------------------------
def initialize_blockchain_url():
    if os.getenv("QUICKNODE_URL"):
        return os.getenv("QUICKNODE_URL")
    if os.getenv("ALCHEMY_API_URL"):
        return os.getenv("ALCHEMY_API_URL")
    if os.getenv("ALCHEMY_API_KEY"):
        return f"https://eth-sepolia.g.alchemy.com/v2/{os.getenv('ALCHEMY_API_KEY')}"
    raise RuntimeError("No RPC URL found. Set QUICKNODE_URL, ALCHEMY_API_URL, or ALCHEMY_API_KEY")

@lru_cache(maxsize=1)

def get_provider():
    rpc = initialize_blockchain_url()
    w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 30}))
    if not w3.is_connected():
        raise RuntimeError("Blockchain connection failed")
    return w3


# ABI with all functions from server.js
# -----------------------------
contractABI = json.loads("""[
  {
    "inputs":[{"internalType":"string","name":"_tokenSymbol","type":"string"}],
    "name":"getProjectByToken",
    "outputs":[{"components":[
      {"internalType":"string","name":"projectId","type":"string"},
      {"internalType":"string","name":"ipfsCID","type":"string"},
      {"internalType":"string","name":"expectedSHA256Hash","type":"string"},
      {"internalType":"string","name":"actualSHA256Hash","type":"string"},
      {"internalType":"string","name":"tokenSymbol","type":"string"},
      {"internalType":"address","name":"projectOwner","type":"address"},
      {"internalType":"address","name":"sabzaValidator","type":"address"},
      {"internalType":"uint8","name":"status","type":"uint8"},
      {"internalType":"uint256","name":"submissionTimestamp","type":"uint256"},
      {"internalType":"uint256","name":"validationTimestamp","type":"uint256"},
      {"internalType":"uint256","name":"tokenizationTimestamp","type":"uint256"},
      {"internalType":"string","name":"metadata","type":"string"},
      {"internalType":"bool","name":"isReadyForBitbond","type":"bool"}
    ],
    "internalType":"struct Project","name":"","type":"tuple"}],
    "stateMutability":"view","type":"function"
  },
  {
    "inputs":[{"internalType":"string","name":"_projectId","type":"string"}],
    "name":"getProject",
    "outputs":[{"components":[
      {"internalType":"string","name":"projectId","type":"string"},
      {"internalType":"string","name":"ipfsCID","type":"string"},
      {"internalType":"string","name":"expectedSHA256Hash","type":"string"},
      {"internalType":"string","name":"actualSHA256Hash","type":"string"},
      {"internalType":"string","name":"tokenSymbol","type":"string"},
      {"internalType":"address","name":"projectOwner","type":"address"},
      {"internalType":"address","name":"sabzaValidator","type":"address"},
      {"internalType":"uint8","name":"status","type":"uint8"},
      {"internalType":"uint256","name":"submissionTimestamp","type":"uint256"},
      {"internalType":"uint256","name":"validationTimestamp","type":"uint256"},
      {"internalType":"uint256","name":"tokenizationTimestamp","type":"uint256"},
      {"internalType":"string","name":"metadata","type":"string"},
      {"internalType":"bool","name":"isReadyForBitbond","type":"bool"}
    ],
    "internalType":"struct Project","name":"","type":"tuple"}],
    "stateMutability":"view","type":"function"
  },
  {
    "inputs":[],
    "name":"getAllValidatedProjects",
    "outputs":[{"components":[
      {"internalType":"string","name":"projectId","type":"string"},
      {"internalType":"string","name":"ipfsCID","type":"string"},
      {"internalType":"string","name":"expectedSHA256Hash","type":"string"},
      {"internalType":"string","name":"actualSHA256Hash","type":"string"},
      {"internalType":"string","name":"tokenSymbol","type":"string"},
      {"internalType":"address","name":"projectOwner","type":"address"},
      {"internalType":"address","name":"sabzaValidator","type":"address"},
      {"internalType":"uint8","name":"status","type":"uint8"},
      {"internalType":"uint256","name":"submissionTimestamp","type":"uint256"},
      {"internalType":"uint256","name":"validationTimestamp","type":"uint256"},
      {"internalType":"uint256","name":"tokenizationTimestamp","type":"uint256"},
      {"internalType":"string","name":"metadata","type":"string"},
      {"internalType":"bool","name":"isReadyForBitbond","type":"bool"}
    ],
    "internalType":"struct Project[]","name":"","type":"tuple[]"}],
    "stateMutability":"view","type":"function"
  },
  {
    "inputs":[{"internalType":"uint8","name":"_status","type":"uint8"}],
    "name":"getProjectsByStatus",
    "outputs":[{"components":[
      {"internalType":"string","name":"projectId","type":"string"},
      {"internalType":"string","name":"ipfsCID","type":"string"},
      {"internalType":"string","name":"expectedSHA256Hash","type":"string"},
      {"internalType":"string","name":"actualSHA256Hash","type":"string"},
      {"internalType":"string","name":"tokenSymbol","type":"string"},
      {"internalType":"address","name":"projectOwner","type":"address"},
      {"internalType":"address","name":"sabzaValidator","type":"address"},
      {"internalType":"uint8","name":"status","type":"uint8"},
      {"internalType":"uint256","name":"submissionTimestamp","type":"uint256"},
      {"internalType":"uint256","name":"validationTimestamp","type":"uint256"},
      {"internalType":"uint256","name":"tokenizationTimestamp","type":"uint256"},
      {"internalType":"string","name":"metadata","type":"string"},
      {"internalType":"bool","name":"isReadyForBitbond","type":"bool"}
    ],
    "internalType":"struct Project[]","name":"","type":"tuple[]"}],
    "stateMutability":"view","type":"function"
  },
  {
    "inputs":[{"internalType":"string","name":"_projectId","type":"string"}],
    "name":"verifyProjectProof",
    "outputs":[
      {"internalType":"bool","name":"isValid","type":"bool"},
      {"internalType":"string","name":"ipfsCID","type":"string"},
      {"internalType":"string","name":"expectedHash","type":"string"},
      {"internalType":"string","name":"actualHash","type":"string"},
      {"internalType":"address","name":"sabzaValidator","type":"address"},
      {"internalType":"uint8","name":"status","type":"uint8"}
    ],
    "stateMutability":"view","type":"function"
  }
]""")


@lru_cache(maxsize=1)
def get_contract():
    address = os.getenv("CONTRACT_ADDRESS")
    if not address:
        raise RuntimeError("CONTRACT_ADDRESS not set")
    return get_provider().eth.contract(address=Web3.to_checksum_address(address), abi=contractABI)

contract = get_contract()

# -----------------------------
# Status Mapping
# -----------------------------
ValidationStatus = {
    0: "Pending",
    1: "SABZAValidated",
    2: "ReadyForTokenization",
    3: "Tokenized",
    4: "Rejected"
}

# -----------------------------
# Helpers
# -----------------------------
def get_block_number():
    return get_provider().eth.block_number

def formatProject(p):
    """Mirror server.js formatProject"""
    submission_ts = int(p[8])
    validation_ts = int(p[9])
    tokenization_ts = int(p[10])
    return {
        "projectId": p[0],
        "ipfsCID": p[1],
        "expectedSHA256Hash": p[2],
        "actualSHA256Hash": p[3],
        "tokenSymbol": p[4],
        "projectOwner": p[5],
        "sabzaValidator": p[6],
        "status": ValidationStatus.get(int(p[7]), "Unknown"),
        "statusCode": int(p[7]),
        "submissionTimestamp": str(submission_ts),
        "validationTimestamp": str(validation_ts),
        "tokenizationTimestamp": str(tokenization_ts),
        "metadata": p[11],
        "isReadyForBitbond": bool(p[12]),
        "ipfsUrl": f"https://gateway.pinata.cloud/ipfs/{p[1]}",
        "submissionDate": None if submission_ts == 0 else __import__("datetime").datetime.utcfromtimestamp(submission_ts).isoformat(),
        "validationDate": None if validation_ts == 0 else __import__("datetime").datetime.utcfromtimestamp(validation_ts).isoformat(),
        "tokenizationDate": None if tokenization_ts == 0 else __import__("datetime").datetime.utcfromtimestamp(tokenization_ts).isoformat(),
    }

# -----------------------------
# Contract Call Wrappers
# -----------------------------
def get_project(project_id: str):
    """Fetch a single project by ID"""
    raw_project = contract.functions.getProject(project_id).call()
    return {
            "projectId": raw_project[0],
            "ipfsCID": raw_project[1],
            "expectedSHA256Hash": raw_project[2],
            "actualSHA256Hash": raw_project[3],
            "tokenSymbol": raw_project[4],
            "projectOwner": raw_project[5],
            "sabzaValidator": raw_project[6],
            "status": raw_project[7],   # int (statusCode)
            "submissionTimestamp": raw_project[8],
            "validationTimestamp": raw_project[9],
            "tokenizationTimestamp": raw_project[10],
            "metadata": raw_project[11],
        }

def get_all_projects():
    """Fetch all projects by combining all statuses"""
    all_projects = []
    for status in range(5):  # 0=Pending, 1=Validated, 2=ReadyForTokenization, 3=Tokenized, 4=Rejected
        projects = contract.functions.getProjectsByStatus(status).call()
        all_projects.extend(projects)
    return all_projects

def get_all_validated_projects():
    """Fetch all validated projects"""
    return contract.functions.getAllValidatedProjects().call()

def get_all_pending_projects():
    return contract.functions.getProjectsByStatus(0).call()  


def get_project_by_token(symbol: str):
    """Fetch a single project by token symbol"""
    return contract.functions.getProjectByToken(symbol.upper()).call()

def get_projects_by_status(status_code: int):
    """Fetch all projects by status code (0–4)"""
    return contract.functions.getProjectsByStatus(int(status_code)).call()

def verifyProjectProof(project_id: str):
    """Verify a project's proof by ID"""
    return contract.functions.verifyProjectProof(project_id).call()