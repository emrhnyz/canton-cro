// CRO live-drill step 0 (remote console): scenario precondition.
// Baseline "Adım 0": party enabled on source + at least one active contract
// so the offline replication path is the correct one.
// Params via system properties: -Dcro.dar=<path> -Dcro.partyHint=<hint>
import scala.jdk.CollectionConverters._
import com.digitalasset.canton.examples.java.iou.{Amount, Iou}

val croDar = sys.props.getOrElse("cro.dar", { println("CRO_ERR -Dcro.dar missing"); sys.exit(1); "" })
val croHint = sys.props.getOrElse("cro.partyHint", "alice")

// DAR on source (target upload happens in step vet_packages)
participant1.dars.upload(croDar)

val croParty = participant1.parties.enable(croHint, synchronizer = Some("da"))

// One active contract so alice's ACS is non-empty (self Iou).
val croAmt = new Amount(java.math.BigDecimal.valueOf(100), "CRO")
val croCmd = new Iou(
  croParty.toProtoPrimitive,
  croParty.toProtoPrimitive,
  croAmt,
  List.empty.asJava,
).create.commands.asScala.toSeq
participant1.ledger_api.javaapi.commands.submit(Seq(croParty), croCmd)

val croAcs = participant1.ledger_api.state.acs.of_party(croParty)
if (croAcs.isEmpty) { println("CRO_ERR source ACS empty after Iou create"); sys.exit(1) }

println(s"CRO_VAR partyId=${croParty.toProtoPrimitive}")
println(s"CRO_VAR sourceAcsCount=${croAcs.size}")
println("CRO_SETUP_OK")
