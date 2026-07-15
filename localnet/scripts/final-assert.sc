// CRO live-drill final assert (remote console).
// Baseline "Uçtan uca başarı": party is multi-hosted and the target
// actually sees the party's contracts (the strongest observable signal).
// Params: -Dcro.party=<full party id>
import com.digitalasset.canton.topology.PartyId

val croPartyStr =
  sys.props.getOrElse("cro.party", { println("CRO_ERR -Dcro.party missing"); sys.exit(1); "" })
val croParty = PartyId.tryFromProtoPrimitive(croPartyStr)

// 1) Target hosts the party (topology view on target).
val croHosted = participant2.parties.list(filterParty = croParty.filterString).nonEmpty
if (!croHosted) { println("CRO_ERR party not visible in target topology"); sys.exit(1) }

// 2) Target sees the party's active contracts (ACS landed).
val croAcs = participant2.ledger_api.state.acs.of_party(croParty)
println(s"CRO_VAR targetAcsCount=${croAcs.size}")
if (croAcs.isEmpty) { println("CRO_ERR target ACS empty for party"); sys.exit(1) }

// 3) Source still hosts the party too (replication, not migration —
//    offboarding is unsupported by protocol, baseline "Bilinçli riskler" #5).
val croSrcAcs = participant1.ledger_api.state.acs.of_party(croParty)
if (croSrcAcs.isEmpty) { println("CRO_ERR source lost the party ACS (unexpected)"); sys.exit(1) }

println("CRO_ASSERT_OK")
