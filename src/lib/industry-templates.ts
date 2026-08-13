// Shared industry templates — used by both the onboarding wizard (suggestions)
// and the demo seed (realistic data per industry).

export interface DemoSOP {
  title: string
  description: string
  category: string
  assetType: string | null
  version: string
  content: string   // markdown with ## sections
}

export interface IndustryTemplate {
  key: string                                            // machine-readable key
  label: string                                          // display name (matches INDUSTRIES in wizard)
  demoCompanyName: string
  departments: string[]
  issueTypeLabels: string[]                              // labels from wizard ISSUE_TYPES to pre-select
  demoLocations: Array<{ name: string; locationType: string }>
  demoVendors: Array<{ name: string; specialty: string }>
  demoSOPs: DemoSOP[]
}

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    key: "manufacturing",
    label: "Manufacturing",
    demoCompanyName: "Acme Manufacturing",
    departments: ["Production", "Maintenance", "Quality Control", "Safety", "Shipping"],
    issueTypeLabels: ["Maintenance", "Safety", "Quality Control", "Operations", "Facilities"],
    demoLocations: [
      { name: "Main Plant",              locationType: "Plant" },
      { name: "Distribution Warehouse",  locationType: "Warehouse" },
      { name: "Corporate Office",        locationType: "Office" },
    ],
    demoVendors: [
      { name: "ProMech Industrial Services", specialty: "Equipment Repair" },
      { name: "SafeGuard Compliance",        specialty: "Safety & Compliance" },
      { name: "Precision Parts Supply",      specialty: "Parts & Components" },
    ],
    demoSOPs: [
      {
        title: "Forklift Pre-Operation Inspection Procedure",
        description: "Mandatory pre-shift inspection checklist for all electric and LP forklift units before operation.",
        category: "SAFETY",
        assetType: "VEHICLE",
        version: "2.1",
        content: `## 1. Purpose
This procedure ensures all forklift units are mechanically safe and operationally sound before each shift. No operator may drive a forklift unit without completing this checklist first.

## 2. Pre-Start Visual Inspection
Inspect the following before starting the engine:
- **2.1 Tires**: Check all four tires for cuts, gouges, flat spots, or under-inflation. Electric units: check drive wheel for wear exceeding one-third of original tread depth.
- **2.2 Forks**: Inspect each fork blade for cracks, bends, or wear exceeding 10% of original blade thickness. Fork tips must be level and even.
- **2.3 Hydraulic System**: Check for visible hydraulic fluid leaks beneath the mast, cylinders, and hoses. Any drip must be reported before operation.
- **2.4 Safety Devices**: Confirm all of the following are functional — horn (audible), backup alarm (audible while reversing), headlights, warning light, and seatbelt (latches securely).
- **2.5 Battery or Fuel**: Electric units: confirm battery charge indicator shows adequate charge for the shift. LP units: confirm tank is full and connection is secure with no fuel smell.

## 3. Operational Function Test
With the forklift running, perform these tests at low speed in a clear area:
- **3.1 Brakes**: Apply brakes firmly at slow speed. Unit must stop completely without pulling to one side.
- **3.2 Steering**: Turn steering wheel left and right through full range. Steering must feel smooth with no binding.
- **3.3 Lift and Tilt**: Raise forks to full lift height and lower. Tilt mast forward and back. Movement must be smooth and controlled.
- **3.4 Horn**: Sound horn and confirm clearly audible output at operator position.

## 4. Documentation
Complete the Forklift Pre-Operation Checklist form attached to each unit's clipboard. Sign and date. Supervisor must initial before shift begins.

## 5. Defect Reporting
Any defect must be reported to the Maintenance department immediately. Tag the unit OUT OF SERVICE. The unit must not be operated until Maintenance clears it in writing and removes the out-of-service tag.`,
      },
      {
        title: "Lockout/Tagout (LOTO) Energy Control Procedure",
        description: "Mandatory procedure for isolating all energy sources before maintenance, repair, or service of any powered equipment.",
        category: "SAFETY",
        assetType: "EQUIPMENT",
        version: "3.0",
        content: `## 1. Purpose
This procedure protects employees from unexpected energization, startup, or release of stored energy during equipment maintenance or servicing. Failure to follow LOTO procedures is a serious safety violation.

## 2. Scope
Applies to all maintenance, repair, cleaning, or unjamming activities on equipment where unexpected energization could cause injury. All employees and on-site contractors must comply.

## 3. Authorized Personnel
Only personnel who have completed LOTO training and are listed on the Authorized Employee Register may apply LOTO controls. Contact the Safety Manager to verify authorization status.

## 4. Lockout Steps — Perform in Order
- **4.1 Notify**: Inform all affected employees that LOTO is being applied and state the reason. Post notice on the equipment.
- **4.2 Identify Energy Sources**: Identify all electrical, pneumatic, hydraulic, steam, and gravity energy sources before proceeding.
- **4.3 Shut Down Equipment**: Use the normal stopping procedure to shut down the equipment completely.
- **4.4 Isolate Energy Sources**: Open electrical disconnects, close pneumatic/hydraulic shutoffs, and block gravity-loaded components.
- **4.5 Apply Locks and Tags**: Each authorized employee applies their own personal padlock and LOTO tag to every isolation point. Multiple employees means multiple locks.
- **4.6 Release Stored Energy**: Bleed down pneumatic and hydraulic pressure to zero. Discharge electrical capacitors. Block or pin any parts that could move under gravity.
- **4.7 Verify Zero Energy**: Attempt to start the equipment using normal controls. Verify no movement or energy response. Verify pressure gauges read zero.

## 5. Restoring Equipment to Service
- **5.1 Clear Work Area**: Remove all tools, test equipment, and materials from the equipment and surrounding area.
- **5.2 Guard Reinstallation**: All machine guards and safety devices MUST be reinstalled and verified in place before any energy is restored. This step is mandatory — bypassing it constitutes a LOTO violation.
- **5.3 Notify Personnel**: Inform all affected employees that LOTO removal is imminent and they must clear the area.
- **5.4 Remove Locks**: Each authorized employee removes only their own personal lock and tag. Locks may only be removed by the person who applied them.
- **5.5 Restore Energy**: Re-energize sources in reverse order of isolation. Stand clear during initial startup.

## 6. Documentation
Complete a LOTO Work Permit before starting any LOTO-controlled work. File completed permits in the Maintenance office for a minimum of 12 months.`,
      },
      {
        title: "Conveyor Belt Maintenance Checklist",
        description: "Scheduled inspection and maintenance tasks for all conveyor belt systems to prevent unplanned failures and production stoppages.",
        category: "MAINTENANCE",
        assetType: "EQUIPMENT",
        version: "1.4",
        content: `## 1. Purpose
This procedure defines the minimum inspection and maintenance tasks required to keep conveyor belt systems running safely and efficiently. Adherence to this schedule reduces unplanned downtime and prevents catastrophic belt failures.

## 2. Daily Inspection — Every Shift Start
- **2.1 Belt Tracking**: Observe belt tracking at the drive pulley and return end. Belt centerline must not deviate more than 1 inch from center. Excessive tracking drift must be reported before running production.
- **2.2 Belt Surface Condition**: Inspect accessible belt surface for cuts, tears, punctures, or signs of delamination. Check splice area at each pass.
- **2.3 Drive Components**: Listen for unusual sounds — grinding, squealing, or thumping — from the drive motor, gearbox, and drive pulley during startup.
- **2.4 Idler Rotation**: Spot-check idlers along the return run. Any non-rotating idler must be reported. Seized idlers cause belt edge damage within hours.
- **2.5 Speed Consistency**: Verify VFD speed display matches production setpoint. Erratic speed display indicates VFD fault requiring immediate investigation.

## 3. Weekly Maintenance
- **3.1 Idler Bearing Lubrication**: Grease all idler bearing fittings per the equipment lubrication schedule. Avoid over-greasing — excess grease attracts debris and damages seals.
- **3.2 Drive Pulley Lagging**: Inspect drive pulley lagging for wear, cracking, or separation. Worn lagging causes belt slipping under load.
- **3.3 Take-Up Tension**: Check take-up mechanism position. Belt tension must be within the manufacturer's specified range. Document take-up weight position.
- **3.4 Guard Completeness**: Confirm all belt guards, nip point guards, and tail pulley guards are securely in place and undamaged.

## 4. Monthly Tasks
- **4.1 Splice Inspection**: With belt stopped, inspect all mechanical or vulcanized splices for fatigue cracks, hook separation, or delamination. Flag any splice showing visible stress.
- **4.2 Drive Motor Temperature**: Record drive motor operating temperature with an infrared thermometer. Compare to baseline. Increase of more than 15°C above baseline requires investigation.
- **4.3 VFD Fault Log**: Access VFD diagnostic display and review fault log. Clear minor faults after documenting. Recurring faults require engineering review.
- **4.4 Full Belt Walk**: With production stopped, walk the full belt length and inspect the underside for wear, embedded debris, and return idler contact.

## 5. Defect Reporting and Escalation
All defects must be entered into the CMMS within one hour of discovery. Critical defects — belt splice failure, belt tears exceeding 6 inches, drive motor faults, or tracking deviation exceeding 3 inches — require immediate notification to the Maintenance Supervisor. Production must not resume until the Supervisor approves restart.`,
      },
      {
        title: "Forklift Battery Charging Procedure",
        description: "Safe handling and charging procedure for all electric forklift battery units to prevent fire, explosion, and chemical hazards.",
        category: "SAFETY",
        assetType: "VEHICLE",
        version: "1.8",
        content: `## 1. Purpose
This procedure ensures safe charging of electric forklift lead-acid batteries. Improper charging practices can cause hydrogen gas buildup, thermal runaway, electrolyte spills, or electrical fires. All employees who charge forklift batteries must be trained and follow this procedure.

## 2. Pre-Charge Inspection — Required Before Every Charge Cycle
- **2.1 Battery Cooling Period**: If the battery has been in heavy use or the battery case feels warm to the touch, allow a minimum 30-minute cooling period before connecting to the charger. Charging a battery above 110°F (43°C) risks thermal runaway and battery damage.
- **2.2 Battery Case Condition**: Inspect battery casing for cracks, bulging, corrosion on terminals, or visible electrolyte leakage. Do not charge a damaged battery — contact Maintenance immediately.
- **2.3 Electrolyte Level Check**: Remove battery vent caps and check electrolyte level. Plates must be submerged. If plates are exposed, add only distilled water to bring level to the correct mark. Never add tap water or acid.
- **2.4 Charging Cable Inspection**: Inspect the charging cable from the charger to the battery connector for fraying, cuts, cracked insulation, or exposed conductors. A damaged cable must be removed from service before any charge is attempted.
- **2.5 Ventilation Verification**: Confirm the charging room exhaust fan is running before connecting any battery. Hydrogen gas produced during charging is explosive at concentrations above 4%. No smoking, open flames, or spark-producing tools are permitted in the charging area.

## 3. Charging Steps
- **3.1 Position Forklift**: Park the forklift in its designated charging bay. Set the parking brake. Turn off the ignition key.
- **3.2 Battery Hood**: Open the battery compartment hood and prop it open to allow heat dissipation during charging.
- **3.3 Connect Charger**: Match the charger output to the battery voltage rating. Connect the charger cable connector to the battery connector firmly. A loose connection causes arcing and heating.
- **3.4 Start Charge Cycle**: Activate the charger. Confirm the charge indicator shows an active charge cycle. Record the start time and charger bay number in the forklift log.
- **3.5 Monitor First 15 Minutes**: Remain near the charging station for the first 15 minutes. If the battery emits a strong sulfur odor, excessive heat, or any unusual sounds, disconnect immediately and notify Maintenance.

## 4. Post-Charge Procedures
- **4.1 Disconnect Charger**: When the charge cycle is complete, disconnect the charger cable from the battery. Never disconnect while the charger is actively charging — disconnect the charger first, then the cable.
- **4.2 Post-Charge Water Level**: After a full charge cycle, check electrolyte level again. Add distilled water if needed to reach the correct fill level. This is the correct time to water — never water before charging.
- **4.3 Close Battery Hood**: Close and latch the battery compartment hood before returning the forklift to service.
- **4.4 Log Completion**: Record charge completion time and any observations in the forklift log.

## 5. Emergency Response
- **Hydrogen Gas Alarm**: Evacuate the charging area immediately. Do not operate any electrical switches. Ventilate and call the supervisor.
- **Electrolyte Spill**: Neutralize with baking soda solution. Flush skin or eyes with water for a minimum of 15 minutes. Seek medical attention for any eye contact.
- **Overheating Battery**: Disconnect the charger immediately. Do not move the battery. Ventilate the area and notify the supervisor. Do not attempt to cool with water.`,
      },
    ],
  },
  {
    key: "warehousing",
    label: "Warehousing & Distribution",
    demoCompanyName: "Metro Distribution Co.",
    departments: ["Shipping", "Receiving", "Inventory Control", "Maintenance"],
    issueTypeLabels: ["Maintenance", "Operations", "Safety", "Facilities"],
    demoLocations: [
      { name: "Distribution Hub — North",  locationType: "Warehouse" },
      { name: "Distribution Hub — South",  locationType: "Warehouse" },
      { name: "Admin Office",              locationType: "Office" },
    ],
    demoVendors: [
      { name: "FleetFix Mobile Repair",      specialty: "Forklift & Fleet Repair" },
      { name: "WareEx Equipment Solutions",  specialty: "Warehouse Equipment" },
      { name: "DockLock Maintenance",        specialty: "Dock Systems" },
    ],
    demoSOPs: [
      {
        title: "Powered Industrial Truck Daily Inspection Checklist",
        description: "Pre-shift safety inspection for all forklifts, pallet jacks, and powered industrial trucks before operation.",
        category: "SAFETY",
        assetType: "VEHICLE",
        version: "2.3",
        content: `## 1. Purpose
All powered industrial truck operators must complete this inspection before starting each shift. Operating a truck that has not been inspected or that has an unreported defect is a safety violation.

## 2. Visual Inspection — Engine Off
- **2.1 Forks and Attachments**: Check for cracks, bends, or uneven tip alignment. Verify any attachment (clamp, rotator) is secure and functioning.
- **2.2 Tires**: Inspect for excessive wear, cuts, or foreign objects. Solid pneumatic tires must not show bonding separation.
- **2.3 Hydraulic Leaks**: Check floor under lift cylinders and mast channels for hydraulic fluid. Any drip must be reported before operation.
- **2.4 Chains and Mast**: Inspect mast channels for cracks. Check lift chains for stretch, rust, or missing links. Chains must be lubricated and even in tension.
- **2.5 Safety Devices**: Test horn (audible burst), backup alarm (sounds while in reverse), seatbelt (latches), and operator presence switch.
- **2.6 Battery or Fuel**: Electric: charge indicator must show adequate charge. LP: check tank level and test connection for fuel smell.

## 3. Operational Check — Engine Running
- **3.1 Brakes**: At slow speed in clear area, apply service brakes firmly. Unit must stop straight without excessive pedal travel.
- **3.2 Steering**: Full left and right steering must be smooth with no binding or excessive play.
- **3.3 Hydraulics**: Raise forks to full height and lower. Tilt mast forward and back. Verify smooth, controlled movement at all speeds.

## 4. Defect Documentation and Reporting
Mark any defect found on the Powered Industrial Truck Inspection Form. Minor defects (non-critical, unit safe to operate): report to supervisor before end of shift. Major defects (brakes, steering, hydraulics, seatbelt, mast): take unit out of service immediately and notify Maintenance. Attach OUT OF SERVICE tag to steering wheel.

## 5. Mast Chain Pre-Shift Verification
- **5.1 Chain Inspection Frequency**: Mast chains must be visually inspected every shift and undergo a hands-on inspection monthly. Any chain showing stretch, corrosion, cracked links, or wear exceeding manufacturer's specification must be replaced before the unit is returned to service.
- **5.2 Load Testing After Chain Work**: After any mast chain replacement or adjustment, a test lift with a rated load must be performed before the unit is cleared for production use.`,
      },
      {
        title: "Dock Safety and Trailer Loading Procedure",
        description: "Safety procedures for dock leveler operation, trailer positioning, and safe loading/unloading of trailers.",
        category: "SAFETY",
        assetType: "FACILITY",
        version: "1.6",
        content: `## 1. Purpose
Loading dock incidents — including forklift falls, trailer separation, and dock leveler failures — represent significant injury risks. This procedure establishes safe practices for all dock activities.

## 2. Trailer Positioning and Restraint
- **2.1 Spotter Required**: All trailers must be spotted into position by a qualified dock worker who guides the driver. No trailer is positioned without a spotter present.
- **2.2 Wheel Chocks**: Wheel chocks must be placed under the rear wheels of every trailer before any dock leveler is extended or any forklift enters the trailer. This is mandatory, not optional.
- **2.3 Vehicle Restraint**: Where vehicle restraint systems (ICC bar hooks) are installed, the restraint must be engaged and the dock light must show green before loading begins. If the restraint system shows a fault, do not proceed — contact Maintenance.
- **2.4 Trailer Integrity Check**: Before entering with a forklift, inspect the trailer floor for soft spots, holes, or damage. Inspect trailer walls for structural damage. Damaged trailers must not be loaded until inspected by a supervisor.

## 3. Dock Leveler Operation
- **3.1 Clear the Dock**: Ensure all personnel are clear of the dock plate area before activating the leveler.
- **3.2 Hydraulic Levelers**: Press and hold the raise button until the leveler reaches full rise, then release. Allow the leveler to float down to the trailer bed under its own weight. Confirm it is resting on the trailer bed before releasing the hold button.
- **3.3 Manual Levelers**: Pull the release handle and allow the leveler to rise. Walk the leveler down onto the trailer bed. Confirm solid contact before use.
- **3.4 Extension Lip**: Confirm the leveler lip is fully extended and engaged on the trailer bed. Minimum lip engagement is 4 inches.
- **3.5 Never Span to Ground**: Do not operate a dock leveler to the "below dock" position with a forklift crossing. Equipment must not bridge to the ground.

## 4. During Loading and Unloading
- **4.1 Pedestrian Exclusion**: No pedestrians are permitted in an active loading lane. Dock doors must be equipped with barrier chains or cones.
- **4.2 Speed Limits**: Maximum forklift speed in dock areas is 5 mph. Operators must reduce speed to walking pace when entering or exiting trailers.
- **4.3 Trailer Movement**: If a trailer shifts during loading, stop immediately. Notify the driver and supervisor before resuming.

## 5. Dock Leveler Inspection
Dock levelers must be inspected weekly. Check hydraulic fluid, spring condition (manual), leveler surface for cracks, and lip hinge for wear. Any leveler that drops more than 1 inch under rated load must be taken out of service and repaired before use.`,
      },
      {
        title: "Battery Room and Charging Safety Procedure",
        description: "Safe operation and maintenance of the battery charging room, including hydrogen hazard control, charging practices, and watering procedures.",
        category: "SAFETY",
        assetType: "EQUIPMENT",
        version: "1.2",
        content: `## 1. Purpose
Battery charging rooms present hydrogen gas explosion, acid burn, and electrical hazards. This procedure controls those hazards and ensures all charging activities are performed safely.

## 2. Battery Room Requirements
- **2.1 Ventilation**: The battery room exhaust fan must be running continuously whenever batteries are connected for charging. Verify fan operation before starting any charge. Hydrogen gas is explosive above 4% concentration.
- **2.2 Ignition Sources**: No smoking, open flames, sparking tools, or non-intrinsically-safe electronics are permitted in the battery room at any time — including when no charging is in progress.
- **2.3 Emergency Equipment**: An eyewash station and acid neutralizing kit (baking soda) must be accessible within 10 seconds of the battery room entrance. Test the eyewash station weekly.
- **2.4 Battery Room Access**: Only trained employees authorized by the Maintenance Supervisor may perform battery watering, equalization charging, or battery replacement.

## 3. Pre-Charge Inspection
- **3.1 Battery Condition**: Inspect the battery case for cracks, bulging, or electrolyte stains. Inspect terminals for corrosion. Do not charge a damaged or corroded battery without Maintenance clearance.
- **3.2 Charger Cable Inspection**: Inspect the charger cable and connector before each use. Any fraying, cuts, cracked insulation, or bent connector pins must be reported to Maintenance. A damaged cable must not be used.
- **3.3 Ventilation Verification**: Confirm exhaust fan is operating before connecting any battery to a charger.
- **3.4 Battery Temperature**: Batteries returned from heavy use may be too hot to charge safely. Touch the battery case — if it is hot, allow a 30-minute minimum cooling period before connecting the charger.

## 4. Charging Operations
- **4.1 Correct Charger Match**: Verify charger voltage and amperage match the battery nameplate specifications before connecting.
- **4.2 Secure Connection**: Connect the charger cable to the battery plug firmly. A loose connection causes arcing and heat.
- **4.3 Monitoring**: Do not leave batteries unattended during the first 15 minutes of a charge cycle. Report any unusual heat, odor, or sounds immediately.
- **4.4 No Interruption**: Do not disconnect a battery mid-charge cycle unless an emergency requires it. Premature disconnection can cause plate sulfation.

## 5. Battery Watering Procedure
- **5.1 Water Only After Full Charge**: Add distilled water only after the battery has completed a full charge cycle, not before. Adding water to a discharged battery dilutes the electrolyte.
- **5.2 Distilled Water Only**: Use only distilled water. Tap water contains minerals that contaminate the electrolyte and reduce battery life.
- **5.3 Fill Level**: Fill to the bottom of the vent well, not above. Overfilling causes electrolyte overflow and acid spills.
- **5.4 PPE Required**: Wear acid-resistant gloves and safety glasses when opening battery vent caps or handling electrolyte.`,
      },
    ],
  },
  {
    key: "retail",
    label: "Retail (Multi-Location)",
    demoCompanyName: "Pinnacle Retail Group",
    departments: ["Store Operations", "Maintenance", "Customer Service", "Loss Prevention"],
    issueTypeLabels: ["Maintenance", "Operations", "Customer Complaints", "Facilities"],
    demoLocations: [
      { name: "Downtown Flagship Store",    locationType: "Retail" },
      { name: "Northside Mall Location",    locationType: "Retail" },
      { name: "Westview Shopping Center",   locationType: "Retail" },
    ],
    demoVendors: [
      { name: "RetailTech Solutions",   specialty: "POS & IT Support" },
      { name: "ComfortAir HVAC",        specialty: "HVAC Services" },
      { name: "StoreFix Contractors",   specialty: "General Repairs" },
    ],
    demoSOPs: [
      {
        title: "Fire Safety Inspection and Emergency Response Procedure",
        description: "Monthly fire safety inspection checklist and response protocol for all retail locations.",
        category: "SAFETY",
        assetType: null,
        version: "2.0",
        content: `## 1. Purpose
This procedure ensures fire suppression and detection systems are maintained in working order and that all employees know how to respond to a fire emergency. OSHA and local fire codes require documented monthly inspections.

## 2. Monthly Inspection Requirements
- **2.1 Fire Extinguisher Check**: Inspect every fire extinguisher for visible damage, correct pressure (needle in green zone), intact pull pin, and legible inspection tag. Record date on the tag.
- **2.2 Exit Signs**: Test all exit signs and emergency lighting by pressing the test button. Each unit must illuminate for at least 90 seconds. Replace any unit that fails.
- **2.3 Egress Paths**: Walk all exit routes from all areas of the store. Confirm no obstacles, locked doors, or stored materials block any egress path. Minimum 28-inch clear width required.
- **2.4 Sprinkler Heads**: Visually inspect all accessible sprinkler heads for damage, corrosion, or obstruction by stored merchandise. No item may be stored within 18 inches below a sprinkler head.
- **2.5 Fire Panel Status**: Check the fire alarm control panel for any active faults or supervisory signals. Document and report any fault to the Facilities team within 24 hours.
- **2.6 Documentation**: Record all inspection results on the Monthly Fire Safety Inspection Form. Submit to the Facilities Manager by the 5th of each month.

## 3. Emergency Response — Fire Alarm Activation
- **3.1 Evacuate First**: Upon alarm activation, initiate customer and employee evacuation immediately. Do not investigate the source of the alarm before starting evacuation.
- **3.2 Call 911**: Call 911 as soon as the alarm sounds. Do not assume it is a false alarm.
- **3.3 Account for Personnel**: Managers must have the current employee count and verify all personnel are evacuated. Do not re-enter the building.
- **3.4 Meet at Assembly Point**: All employees must proceed to the designated assembly point marked on the evacuation map posted at each exit.

## 4. Fire Extinguisher Use (PASS Method)
Only attempt to extinguish a small, contained fire if you have a clear exit path behind you and the fire is no larger than a wastepaper basket:
- **Pull** the pin
- **Aim** at the base of the fire
- **Squeeze** the handle
- **Sweep** side to side`,
      },
      {
        title: "Slip, Trip and Fall Prevention Procedure",
        description: "Hazard identification, spill response, and floor safety standards to prevent customer and employee injuries.",
        category: "SAFETY",
        assetType: null,
        version: "1.5",
        content: `## 1. Purpose
Slip, trip, and fall incidents are the leading cause of injury in retail environments. This procedure establishes minimum standards for floor safety and requires prompt action when hazards are identified.

## 2. Wet Floor Response
- **2.1 Immediate Action**: Any employee who discovers a wet floor must immediately place wet floor signs before leaving the area for any reason — even to get help. Never leave an unmarked wet floor unattended.
- **2.2 Barricade**: For large spills, block the aisle with cones or barriers on all sides. A single wet floor sign is not sufficient for a spill larger than 2 square feet.
- **2.3 Cleanup**: Dry the floor completely before removing signs. The floor must be dry, not just "mostly dry." Walking on a damp floor without signage present is prohibited.
- **2.4 Roof Leaks**: If a roof leak creates a wet floor, place a collection bucket and maintain wet floor signage until the leak is repaired. Report the leak as a Facilities issue immediately.

## 3. Floor Inspection Schedule
- **3.1 Opening Inspection**: The opening manager must walk the entire sales floor before customers enter and document any hazards.
- **3.2 Hourly Checks**: Employees must visually scan their assigned zone at least once per hour and address any hazard found.
- **3.3 Transition Zones**: Entrances and doorways must be checked more frequently in wet weather. Anti-slip entrance mats must be in place at all exterior doors.

## 4. Trip Hazard Control
- **4.1 Power Cords**: No extension cords or power cables may cross a customer walkway unless covered by an approved cord cover.
- **4.2 Stock**: Merchandise and stock must never be placed on the floor in customer areas, even temporarily.
- **4.3 Damaged Flooring**: Any cracked tile, lifted mat edge, or uneven floor surface must be tagged and reported to Facilities the same day it is discovered. Place a cone over the hazard until repaired.`,
      },
    ],
  },
  {
    key: "restaurants",
    label: "Restaurants & Food Service",
    demoCompanyName: "Golden Fork Restaurant Group",
    departments: ["Kitchen", "Front of House", "Maintenance"],
    issueTypeLabels: ["Maintenance", "Safety", "Operations", "Facilities"],
    demoLocations: [
      { name: "Main Restaurant",    locationType: "Retail" },
      { name: "Second Location",    locationType: "Retail" },
      { name: "Catering Kitchen",   locationType: "Service Facility" },
    ],
    demoVendors: [
      { name: "CoolTech Refrigeration",   specialty: "Refrigeration Repair" },
      { name: "ChefPro Equipment",        specialty: "Commercial Kitchen Equipment" },
    ],
    demoSOPs: [
      {
        title: "Food Temperature Safety and Hot Holding Procedure",
        description: "Required temperature control practices for cooking, holding, and serving hot food to prevent foodborne illness.",
        category: "SAFETY",
        assetType: "EQUIPMENT",
        version: "3.1",
        content: `## 1. Purpose
Foodborne illness outbreaks are primarily caused by food held at improper temperatures. This procedure establishes mandatory temperature control requirements for all cooked and hot-held food items.

## 2. Critical Temperature Standards
- **2.1 Danger Zone**: Bacteria multiply rapidly between 41°F and 135°F. Food must not remain in this temperature range for more than 2 hours total (cumulative).
- **2.2 Hot Holding Minimum**: All cooked food held for service must be maintained at 135°F or above at all times. No exceptions.
- **2.3 Cooking Minimums**: Ground beef, pork: 155°F for 15 seconds. Poultry: 165°F for 15 seconds. Fish: 145°F for 15 seconds. Whole muscle beef: 145°F with 3-minute rest.

## 3. Equipment Temperature Verification
- **3.1 Pre-Service Check**: Before service begins, verify all hot holding equipment (steam tables, warmers, heat lamps) reaches operating temperature. Check food temperature in each unit with a calibrated thermometer.
- **3.2 Thermometer Calibration**: Calibrate all probe thermometers at the start of each shift using the ice-water method (32°F) or boiling water method (212°F at sea level). Document calibration in the temperature log.
- **3.3 Steam Table Check**: Steam table water temperature must reach 180°F before food pans are placed in. Do not use a steam table to reheat food — it is a holding device only.

## 4. Monitoring During Service
- **4.1 Hourly Temperature Logs**: Record food temperatures in every hot holding unit at least once per hour during service. Use the Food Temperature Log sheet posted at each station.
- **4.2 Out-of-Range Action**: If any food item reads below 135°F: immediately remove from service, reheat to 165°F, return to hot holding if within 2-hour window. If 2-hour window has passed, discard the food. Do not re-serve food that has been in the danger zone for more than 2 hours.
- **4.3 Equipment Failure**: If any holding equipment malfunctions or fails to maintain temperature, remove all food immediately and notify the Kitchen Manager. Do not continue using malfunctioning equipment.

## 5. Buffet and Warming Oven Standards
- **5.1 Warming Oven Temperature**: All warming ovens used for food holding must maintain an internal air temperature of at least 150°F. Verify with a thermometer, not the oven's dial indicator alone — dial indicators are not always accurate.
- **5.2 Pan Coverage**: All food pans in warming equipment must be covered or held under heat lamps to prevent surface cooling below 135°F.
- **5.3 Replenishment**: When adding fresh food to a holding pan, do not mix fresh product with product already in the pan. Replace the entire pan.`,
      },
      {
        title: "Commercial Kitchen Hood and Exhaust Maintenance",
        description: "Cleaning schedule and inspection procedure for commercial kitchen exhaust hoods to prevent grease fire hazards.",
        category: "MAINTENANCE",
        assetType: "EQUIPMENT",
        version: "2.0",
        content: `## 1. Purpose
Grease buildup in kitchen exhaust systems is the leading cause of commercial kitchen fires. This procedure defines the cleaning and inspection schedule required to maintain safe exhaust system operation and comply with fire code requirements (NFPA 96).

## 2. Daily Cleaning — Kitchen Staff Responsibility
- **2.1 Filters**: Remove hood filters at the end of each service. Wash in the dish machine or a dedicated degreaser soak. Filters must be clean and free of grease buildup before reinstallation.
- **2.2 Hood Interior Surfaces**: Wipe down hood interior surfaces accessible from below with a degreasing solution. Pay particular attention to drip channels and grease troughs.
- **2.3 Grease Collection Cups**: Empty and clean grease collection cups or drip trays below each filter bank. Overfull grease cups are a fire hazard.

## 3. Weekly Inspection
- **3.1 Exhaust Fan Operation**: With the hood running, verify the exhaust fan is operating by holding a paper towel to the hood opening — it should be pulled toward the hood. Report any reduced suction to Maintenance.
- **3.2 Makeup Air**: Verify the makeup air supply is operating. Inadequate makeup air causes poor smoke capture and kitchen pressure issues.
- **3.3 Duct Access Panels**: Inspect duct access panel covers for grease accumulation around the edges, which indicates the duct interior may need professional cleaning.

## 4. Professional Cleaning Schedule
- **4.1 Frequency Requirements**: Kitchens operating 24 hours: quarterly. Kitchens with high-volume char-broiling or wok cooking: quarterly. Standard volume kitchens: semi-annually. Low-volume operations: annually.
- **4.2 Vendor Qualification**: Only IKECA-certified or equivalent certified hood cleaning contractors may perform professional cleaning. Request the vendor's certification before scheduling.
- **4.3 Post-Cleaning Inspection**: After professional cleaning, verify the contractor has cleaned from the filters through the entire ductwork to the fan. Request a cleaning report with photos.
- **4.4 Fire Suppression System**: After any professional cleaning, verify the fire suppression system nozzles are clean and covers are replaced correctly. The suppression system must be inspected semi-annually by a qualified technician.

## 5. Grease Fire Prevention
- **5.1 No Cooking Without Hood Running**: Cooking on any equipment under the hood is prohibited unless the exhaust hood system is running and functioning properly.
- **5.2 Overheating Response**: If excessive smoke or flame is observed from cooking equipment, reduce heat and call for assistance before the fire suppression system activates. An activated suppression system requires a full reset before cooking can resume.`,
      },
    ],
  },
  {
    key: "property",
    label: "Property & Facility Management",
    demoCompanyName: "Apex Property Management",
    departments: ["Maintenance", "Leasing", "Operations", "Landscaping"],
    issueTypeLabels: ["Maintenance", "Facilities", "Customer Complaints", "Safety", "Operations"],
    demoLocations: [
      { name: "Oakwood Apartment Complex",    locationType: "Service Facility" },
      { name: "Riverside Commercial Park",    locationType: "Office" },
      { name: "Westside Self-Storage",        locationType: "Warehouse" },
    ],
    demoVendors: [
      { name: "AllTrade Contractors",   specialty: "General Repairs" },
      { name: "CoolZone HVAC",          specialty: "HVAC Services" },
      { name: "ElectraFix Electrical",  specialty: "Electrical" },
    ],
    demoSOPs: [
      {
        title: "Work Order Safety Entry Procedure",
        description: "Required steps for safely entering occupied residential units for maintenance work orders.",
        category: "SAFETY",
        assetType: null,
        version: "1.7",
        content: `## 1. Purpose
This procedure protects both residents and maintenance staff during unit entry for work order completion. Unauthorized or improperly announced entries expose the property to legal liability and endanger both parties.

## 2. Notice Requirements
- **2.1 Minimum Notice**: Provide written notice to the resident at least 24 hours before entry for non-emergency work orders. Post the notice on the unit door and log the date and time posted.
- **2.2 Emergency Entry**: Entry without notice is permitted only for active emergencies — fire, flooding, gas odor, or immediate safety threat. Document emergency entry reason in the work order within 1 hour of entry.
- **2.3 Resident-Requested Entry**: When a resident requests maintenance and is not home, entry is permitted only with the resident's written (or documented verbal) authorization noted in the work order.

## 3. Entry Protocol
- **3.1 Knock and Announce**: Knock firmly and announce "Maintenance" twice before using your key. Wait a minimum of 30 seconds between knock and entry.
- **3.2 Two-Person Policy**: For entries to units with documented resident concerns, or entries to units believed to be unoccupied, bring a second team member as a witness.
- **3.3 Secure the Work Area**: Do not leave tools, chemicals, or open work areas unattended in an occupied unit. Secure all materials when temporarily leaving.

## 4. Prohibited Actions
- Searching cabinets, closets, or personal belongings for any reason
- Bringing unauthorized individuals into a resident's unit
- Sharing resident information or photos of unit interiors
- Leaving a unit unlocked and unattended for any period

## 5. Documentation
Complete the work order with: entry time, exit time, work performed, and any additional issues observed. If a resident was present, note their name. If a resident makes any complaint during entry, notify the Property Manager before leaving the property.`,
      },
      {
        title: "HVAC Preventive Maintenance Procedure",
        description: "Scheduled inspection and maintenance tasks for HVAC units across all managed properties.",
        category: "MAINTENANCE",
        assetType: "EQUIPMENT",
        version: "2.2",
        content: `## 1. Purpose
Proactive HVAC maintenance reduces emergency calls, extends equipment life, and keeps residents comfortable. This procedure defines the minimum maintenance tasks required at each service interval.

## 2. Filter Replacement Schedule
- **2.1 Residential Units**: Replace air filters every 90 days minimum. High-pet or allergy units: every 60 days. Inspect filter at every work order entry and replace if visibly dirty even if within the 90-day window.
- **2.2 Common Area Units**: Commercial-grade filters in lobbies and fitness centers must be replaced every 30 days or per manufacturer specification.
- **2.3 Filter Documentation**: Record filter size, MERV rating, and replacement date in the HVAC maintenance log for each unit.

## 3. Seasonal Startup Procedures
- **3.1 Cooling Season (Spring)**: Before turning on cooling, clean condenser coils with approved coil cleaner, inspect refrigerant lines for visible damage or ice, verify condensate drain is clear, and test unit operation.
- **3.2 Heating Season (Fall)**: Before turning on heat, inspect heat exchanger for cracks (gas furnaces), test ignition sequence, verify thermocouple or igniter function, and test carbon monoxide detectors in all units.

## 4. Condensate Drain Maintenance
- **4.1 Quarterly Drain Flush**: Flush condensate drain lines with a dilute bleach solution (1 cup bleach per gallon of water) quarterly to prevent algae blockage. Blocked condensate drains cause water damage to ceilings and walls below HVAC units.
- **4.2 Drain Pan Inspection**: At each filter change, inspect the drain pan for standing water or algae growth. Standing water in the drain pan indicates a blocked drain and must be addressed immediately.

## 5. Annual Full Inspection
Annual HVAC inspections must be performed by a licensed HVAC technician and must include: refrigerant level check, electrical connection inspection, blower motor lubrication, heat exchanger inspection (gas units), and a written inspection report. Retain inspection reports for a minimum of 3 years.`,
      },
    ],
  },
  {
    key: "healthcare",
    label: "Healthcare Facilities",
    demoCompanyName: "Summit Healthcare Facilities",
    departments: ["Facilities Management", "Housekeeping", "Clinical Engineering", "Safety"],
    issueTypeLabels: ["Maintenance", "Safety", "Facilities", "HR", "Operations"],
    demoLocations: [
      { name: "Main Hospital Building",    locationType: "Service Facility" },
      { name: "Outpatient Clinic A",       locationType: "Service Facility" },
      { name: "Medical Office Park",       locationType: "Office" },
    ],
    demoVendors: [
      { name: "BioMed Equipment Services",  specialty: "Medical Equipment" },
      { name: "ClinicalCool HVAC",          specialty: "Healthcare HVAC" },
      { name: "LifeSafety Systems",         specialty: "Safety & Security" },
    ],
    demoSOPs: [
      {
        title: "Medical Equipment Failure Response Procedure",
        description: "Immediate response steps when clinical or facilities equipment fails in a patient care environment.",
        category: "SAFETY",
        assetType: "EQUIPMENT",
        version: "3.4",
        content: `## 1. Purpose
Equipment failures in a healthcare environment can directly threaten patient safety. This procedure ensures a rapid, documented response to all equipment failures and that clinical areas are never left without required life-safety systems.

## 2. Immediate Response Steps
- **2.1 Patient Safety First**: If the failed equipment is in use with a patient, the clinical team takes precedence. Facilities staff must not attempt to repair or remove equipment until clinical staff have confirmed the patient is safe and the equipment is cleared for maintenance.
- **2.2 Isolate the Equipment**: Remove the failed equipment from service immediately. For stationary equipment, apply an OUT OF SERVICE tag and physically block access. Do not allow other staff to attempt to operate failed equipment.
- **2.3 Notify Clinical Engineering**: Contact Clinical Engineering immediately for any equipment directly involved in patient care. Log the call time and the name of the person notified.
- **2.4 Provide Backup**: For critical systems (oxygen delivery, suction, call systems), Facilities must activate or confirm availability of backup systems before leaving the area.

## 3. Documentation Requirements
Within 2 hours of any equipment failure, enter a work order in the CMMS with: equipment ID, location, failure description, time of failure, patient impact (yes/no), and immediate action taken. For any failure with patient impact, also complete the Incident Report form and notify the Risk Management office.

## 4. Life Safety System Failures
Failures of fire alarms, suppression systems, emergency lighting, patient call systems, or medical gas systems must be treated as critical incidents:
- **4.1 Immediate Notification**: Notify the Administrator on Duty immediately, regardless of time of day.
- **4.2 Fire Watch**: If the fire detection or suppression system is impaired, implement a fire watch per the Life Safety Management Plan until the system is restored.
- **4.3 Regulatory Notification**: Certain life safety impairments require notification to The Joint Commission and local authorities having jurisdiction. Confirm requirements with the Compliance Officer.

## 5. Return to Service
No failed equipment may be returned to service without documented confirmation from Clinical Engineering or a qualified technician that the failure has been corrected and the equipment is safe for use. A test run must be performed and documented before clinical use resumes.`,
      },
      {
        title: "Infection Control and Environmental Services Standards",
        description: "Minimum cleanliness and disinfection standards for all patient care and high-touch areas.",
        category: "SAFETY",
        assetType: null,
        version: "4.1",
        content: `## 1. Purpose
Healthcare-associated infections (HAIs) are a major patient safety risk. Environmental services standards directly impact infection rates. This procedure defines the minimum cleaning and disinfection requirements for all patient care areas.

## 2. Disinfectant Selection and Use
- **2.1 Approved Products Only**: Only EPA-registered disinfectants on the facility's approved product list may be used in patient care areas. Do not substitute cleaning products without approval from Infection Control.
- **2.2 Contact Time**: Disinfectants only work if the surface remains visibly wet for the product's required contact time (listed on the label). Wiping a surface dry immediately after application does not disinfect. Apply product and allow full contact time before wiping or drying.
- **2.3 Clean to Dirty Direction**: Always clean from the cleanest area to the most contaminated area — top to bottom, entrance to exit, patient area to bathroom.

## 3. High-Touch Surface Frequency
- **3.1 Patient Rooms**: High-touch surfaces (call button, bed rails, TV remote, door handles, light switches, over-bed table) must be disinfected at minimum: upon room entry, after any patient contact, and upon room departure.
- **3.2 Restrooms**: Restrooms in patient care areas must be cleaned and disinfected every 2 hours during occupied hours. Document time and initials on the door cleaning log.
- **3.3 Common Areas**: Elevator buttons, waiting room armrests, and reception counters must be disinfected at minimum every 2 hours.

## 4. Terminal Cleaning Procedure
When a patient room is vacated (discharge, transfer, or death), a terminal clean is required before the room is reassigned:
- **4.1 All Surfaces**: Disinfect all surfaces including ceiling-mounted equipment, walls at splash zones, bed frame, mattress (top, bottom, sides), and all furniture.
- **4.2 Mattress Inspection**: Inspect the mattress cover for tears or soiling. A damaged mattress cover must be replaced before the room is cleared.
- **4.3 Supervisor Sign-Off**: Terminal cleans must be signed off by an EVS supervisor before the room is cleared for the next patient.`,
      },
    ],
  },
  {
    key: "education",
    label: "Education & Campus Operations",
    demoCompanyName: "Westbrook Campus Operations",
    departments: ["Facilities", "Maintenance", "Administration", "Custodial"],
    issueTypeLabels: ["Maintenance", "Facilities", "Safety", "Operations"],
    demoLocations: [
      { name: "Main Academic Building",  locationType: "Service Facility" },
      { name: "Student Center",          locationType: "Service Facility" },
      { name: "Athletic Complex",        locationType: "Service Facility" },
    ],
    demoVendors: [
      { name: "CampusMaint Solutions",  specialty: "Facilities Repair" },
      { name: "AquaTech Plumbing",      specialty: "Plumbing" },
      { name: "EduLight Electrical",    specialty: "Electrical" },
    ],
    demoSOPs: [
      {
        title: "Campus Fire Safety Inspection Procedure",
        description: "Monthly fire safety and egress inspection checklist for all campus buildings.",
        category: "SAFETY",
        assetType: null,
        version: "2.3",
        content: `## 1. Purpose
Campus buildings are occupied by students, staff, and visitors who rely on functioning fire safety systems. This procedure ensures monthly inspections are completed and documented to maintain code compliance and protect occupant safety.

## 2. Monthly Inspection Checklist
- **2.1 Fire Extinguishers**: Inspect every extinguisher for intact seal, correct pressure, current inspection tag (within 12 months), and no visible damage. Record on the inspection log attached to each extinguisher.
- **2.2 Exit Signs and Emergency Lighting**: Test all exit signs and emergency lights by pressing the test button on each unit. Unit must illuminate for 90 seconds minimum. Replace any failed unit within 24 hours.
- **2.3 Egress Paths**: Walk every corridor and stairwell designated as an egress path. Confirm no propped-open fire doors, blocked corridors, or storage within the required clear width.
- **2.4 Fire Doors**: Test fire door hold-open devices by releasing the magnetic hold. Door must swing fully closed and latch under its own spring action. A fire door that does not latch must be reported to Facilities immediately.
- **2.5 Sprinkler Clearance**: Visually inspect sprinkler heads for 18-inch minimum clearance below. Report any storage placed within 18 inches of a sprinkler head.

## 3. High-Risk Areas — Additional Monthly Checks
- **3.1 Science Labs**: Verify chemical storage is in approved flammable storage cabinets. Verify eyewash and safety shower are operational (run for 30 seconds and document).
- **3.2 Custodial Closets**: Inspect for correct storage of flammable cleaning products (no more than one day's supply outside approved storage). Inspect electrical outlets for overloading.
- **3.3 Kitchen Areas**: Verify hood suppression system inspection tag is current (semi-annual). Verify no combustible materials are stored within 2 feet of cooking equipment.

## 4. Documentation and Reporting
Complete the Campus Fire Safety Inspection Form for each building. Submit to the Facilities Manager within 3 days of inspection. Any critical deficiency (non-functioning exit sign, blocked egress, failed fire door) must be reported immediately and corrected within 24 hours.`,
      },
      {
        title: "Playground and Athletic Equipment Safety Inspection",
        description: "Weekly and monthly safety inspection protocol for all playground equipment, bleachers, and athletic structures.",
        category: "SAFETY",
        assetType: "EQUIPMENT",
        version: "1.4",
        content: `## 1. Purpose
Students are injured by defective playground and athletic equipment every year. Regular inspection catches hazards before they cause injury and documents the institution's due diligence.

## 2. Weekly Visual Inspection
- **2.1 Structural Integrity**: Walk around and visually inspect all climbing structures, swings, and slides for visible cracks, bends, or structural deformation.
- **2.2 Hardware**: Check all bolts, nuts, and connection hardware for protrusion beyond the nut face by more than 2 thread lengths. Check for missing hardware.
- **2.3 Surfacing**: Inspect fall zone surfacing (wood chips, rubber tiles, sand) for adequate depth (minimum 9 inches for equipment over 5 feet). Fill or notify Facilities if material is compacted or displaced.
- **2.4 Entrapment Hazards**: Check for openings that could entrap a child's head (between 3.5 and 9 inches are entrapment hazards). Check for protrusions that could catch clothing.

## 3. Monthly Functional Inspection
- **3.1 Moving Parts**: Test all swings, spring riders, and rotating equipment for smooth, controlled movement. Apply lubricant to swing chains and pivot points per manufacturer's specification.
- **3.2 Bleachers**: Walk every row of bleacher seating. Check for cracked or missing boards, loose railings, and guardrail integrity. Inspect under-bleacher area for foreign objects or vandalism.
- **3.3 Drainage**: Confirm the fall zone around each equipment structure drains properly. Standing water must not be present 24 hours after rainfall.

## 4. Out-of-Service Protocol
If any equipment is found with a structural defect, missing safety component, or hazard that cannot be immediately corrected: close off the equipment with barrier tape and an OUT OF SERVICE sign, document the defect and the date it was found, and notify Facilities for repair scheduling. Equipment must not be returned to service until repairs are completed and re-inspected.`,
      },
    ],
  },
  {
    key: "hospitality",
    label: "Hospitality & Hotels",
    demoCompanyName: "Luxe Hotel & Resorts",
    departments: ["Housekeeping", "Maintenance", "Front Desk", "Food & Beverage"],
    issueTypeLabels: ["Maintenance", "Customer Complaints", "Operations", "Facilities"],
    demoLocations: [
      { name: "Grand Hotel Tower",      locationType: "Service Facility" },
      { name: "Beach Resort Wing",      locationType: "Service Facility" },
      { name: "Conference Center",      locationType: "Service Facility" },
    ],
    demoVendors: [
      { name: "HospAir HVAC Services",    specialty: "Hotel HVAC" },
      { name: "ElitePlumbing",            specialty: "Plumbing & Fixtures" },
      { name: "GuestComfort Supplies",    specialty: "Hotel Supplies" },
    ],
    demoSOPs: [
      {
        title: "Food Temperature Safety and Buffet Holding Procedure",
        description: "Temperature monitoring and hot/cold food holding standards for all food and beverage service areas.",
        category: "SAFETY",
        assetType: "EQUIPMENT",
        version: "2.4",
        content: `## 1. Purpose
Improper food temperature control is the primary cause of foodborne illness outbreaks in hospitality settings. This procedure is required to protect guests and comply with health department regulations.

## 2. Critical Temperature Limits
- **2.1 Hot Holding**: All hot food must be held at 135°F (57°C) or above at all times. Temperature below 135°F places food in the Danger Zone.
- **2.2 Cold Holding**: All cold food must be held at 41°F (5°C) or below. Food above 41°F for more than 2 cumulative hours must be discarded.
- **2.3 Danger Zone**: Between 41°F and 135°F, bacteria can double every 20 minutes. Food may not remain in the danger zone for more than 2 hours total.

## 3. Buffet and Warming Equipment Standards
- **3.1 Pre-Service Verification**: Before any food is placed in warming equipment (chafing dishes, steam tables, warming ovens), verify the equipment has reached operating temperature using a calibrated probe thermometer. Do not rely on equipment dial indicators alone.
- **3.2 Warming Oven Temperature**: Warming ovens used for food holding must maintain a minimum internal temperature of 150°F. Verify with a thermometer placed in the center of the oven, not near the heating element.
- **3.3 Steam Table Water Temperature**: Steam table water must reach 180°F before food pans are placed in. Check water temperature, not just food temperature.
- **3.4 Heat Lamp Distance**: Food held under heat lamps must be positioned at the correct distance specified by the equipment manufacturer. Incorrect distance results in uneven heating and cold spots.

## 4. Temperature Monitoring During Service
- **4.1 Logging Frequency**: Check and log the temperature of every hot holding item every 30 minutes during service using a calibrated probe thermometer. Record time and temperature on the Food Temperature Log.
- **4.2 Out-of-Range Response**: Any item reading below 135°F must be immediately removed from the buffet. If within the 2-hour window, the item may be reheated to 165°F and returned. If the 2-hour limit has passed, discard the item. Do not continue serving food that has fallen below temperature.
- **4.3 Equipment Malfunction**: If any holding equipment fails to maintain temperature, remove all food immediately and notify the F&B Manager. Contact Maintenance. Do not use malfunctioning equipment.

## 5. Thermometer Calibration
All probe thermometers must be calibrated at the start of every shift using the ice-water method: fill a glass with crushed ice and cold water, insert the probe to the center, and verify it reads 32°F ± 2°F. A thermometer outside this range must be replaced or sent for calibration before use.`,
      },
      {
        title: "Elevator Emergency and Entrapment Response Procedure",
        description: "Response protocol for elevator malfunctions, entrapments, and required out-of-service actions.",
        category: "SAFETY",
        assetType: "EQUIPMENT",
        version: "1.9",
        content: `## 1. Purpose
Elevator malfunctions can range from minor inconveniences to life-safety emergencies. This procedure ensures staff respond appropriately, protect guests, and coordinate with the elevator service contractor without attempting unsafe interventions.

## 2. Guest Entrapment Response
If a guest is trapped inside an elevator:
- **2.1 Immediate Communication**: Speak to the trapped guest through the intercom or door. Reassure them that help is on the way. Do not leave the area until they are released.
- **2.2 Call 911 if Needed**: If any guest in the elevator is having a medical emergency, is in distress, or if the elevator is between floors, call 911 immediately in addition to the elevator service line.
- **2.3 Call the Elevator Contractor**: Contact the 24-hour elevator service hotline immediately. Provide the building address, elevator ID number, floor location, and number of persons trapped.
- **2.4 Do Not Force Doors**: Under no circumstances should staff attempt to manually force elevator doors open or assist guests in exiting through a gap in the doors. Severe crush injury or falls can result. Wait for the elevator technician.
- **2.5 Notify Management**: Notify the General Manager or Manager on Duty immediately. Log the time and details of the incident.

## 3. Elevator Out-of-Service Procedure
When an elevator malfunctions and must be taken out of service:
- **3.1 Immediate Posting**: Place OUT OF SERVICE signs on all landings and physically block elevator call buttons to prevent use.
- **3.2 Guest Notification**: Notify the Front Desk to advise arriving guests of the elevator status and direct them to available elevators. Arrange luggage assistance for guests unable to use stairs.
- **3.3 Service Contractor Dispatch**: Contact the elevator service contractor immediately. Target response time is 2 hours for any elevator in a public area. Escalate to management if response time will exceed 4 hours.
- **3.4 ADA Consideration**: If the property's only accessible elevator is out of service, contact the General Manager immediately. An ADA-accessible room relocation plan must be activated for guests who cannot use stairs.

## 4. Return to Service
An elevator may not be returned to service until the elevator technician has completed repairs and provided written clearance. The OUT OF SERVICE signs and barriers must remain in place until cleared by the technician. Do not override or reset the elevator without technician authorization.`,
      },
      {
        title: "Pool Water Safety and Chemical Handling Procedure",
        description: "Pool water chemistry testing, chemical dosing, and disinfection standards to maintain safe guest swimming conditions.",
        category: "SAFETY",
        assetType: "EQUIPMENT",
        version: "2.1",
        content: `## 1. Purpose
Pool water that is improperly maintained can cause illness or injury to guests. This procedure establishes the minimum standards for pool water testing, chemical dosing, and response to out-of-range conditions.

## 2. Required Water Chemistry Ranges
- **2.1 Free Chlorine**: 1.0 – 3.0 ppm. Below 1.0 ppm is unsafe for guest use. Above 10.0 ppm requires pool closure.
- **2.2 pH**: 7.2 – 7.8. Outside this range, chlorine effectiveness drops significantly and guest irritation increases.
- **2.3 Total Alkalinity**: 80 – 120 ppm. Alkalinity stabilizes pH.
- **2.4 Cyanuric Acid (outdoor pools)**: 30 – 50 ppm. Above 100 ppm significantly reduces chlorine effectiveness.
- **2.5 Combined Chlorine (Chloramines)**: Must not exceed 0.5 ppm. High combined chlorine indicates inadequate disinfection and causes eye/respiratory irritation.

## 3. Testing Schedule
- **3.1 Frequency**: Test pool water chemistry a minimum of twice daily — once before the pool opens for guests and once at midday. During high-bather load, test every 2 hours.
- **3.2 Test Methods**: Use a DPD-based test kit (not OTO/yellow test). Record all readings on the Pool Chemistry Log with date, time, and tester initials.
- **3.3 Out-of-Range Action**: Any test result outside the required ranges must be addressed before guests are permitted in the water. If free chlorine reads below 1.0 ppm, close the pool immediately and add chlorine. Retest before reopening.

## 4. Chemical Dosing and Handling
- **4.1 Automated Dosing Systems**: Verify automated chemical dosing pumps are functioning at each morning startup. A non-functioning dosing pump must be repaired before pool opening. Manual dosing as backup is permitted if tested every 2 hours.
- **4.2 Chemical Storage**: Pool chemicals must be stored in locked, ventilated, dedicated storage. Oxidizers (shock/chlorine) and acids (pH down) must be stored separately — mixing causes dangerous chemical reactions.
- **4.3 PPE Required**: Always wear chemical-resistant gloves and eye protection when handling pool chemicals.
- **4.4 Never Mix Chemicals**: Never mix different pool chemicals together, including products of the same type from different manufacturers. Pre-dissolve dry chemicals in a bucket of water before adding to pool.`,
      },
    ],
  },
  {
    key: "multisite",
    label: "Multi-Site Operations",
    demoCompanyName: "Nationwide Site Operations",
    departments: ["Site Operations", "Maintenance", "Customer Service"],
    issueTypeLabels: ["Maintenance", "Operations", "Customer Complaints", "Facilities"],
    demoLocations: [
      { name: "Site Alpha",   locationType: "Service Facility" },
      { name: "Site Beta",    locationType: "Service Facility" },
      { name: "Site Gamma",   locationType: "Service Facility" },
    ],
    demoVendors: [
      { name: "SiteServ Maintenance Co.",  specialty: "Multi-Site Repairs" },
      { name: "TechFix Systems",           specialty: "Technology & Equipment" },
    ],
    demoSOPs: [
      {
        title: "Fire Safety and Life Safety Inspection Procedure",
        description: "Monthly life safety inspection for fire suppression, egress, and emergency systems at all managed sites.",
        category: "SAFETY",
        assetType: null,
        version: "1.8",
        content: `## 1. Purpose
Maintaining fire and life safety systems is a legal requirement and a fundamental duty of care for all site personnel and visitors. This procedure defines the minimum monthly inspection that must be completed at every managed site.

## 2. Monthly Inspection Checklist
- **2.1 Fire Extinguishers**: Visually inspect every extinguisher. Confirm pressure gauge is in the green zone, pull pin and tamper seal are intact, and the annual inspection tag is within 12 months. Record on the site inspection log.
- **2.2 Exit and Emergency Lighting**: Test all exit signs and emergency lights using the test button. Each unit must stay illuminated for a minimum of 90 seconds. Document any failures and replace within 24 hours.
- **2.3 Egress Paths**: Walk all designated exit routes. Confirm no storage, locked doors, or obstacles block any egress path. Minimum 28-inch clear width must be maintained.
- **2.4 Sprinkler Heads**: Visually inspect sprinkler heads for damage, corrosion, or obstruction by storage or signage. The 18-inch clearance zone below each head must be maintained.
- **2.5 Fire Panel**: Check the main fire alarm control panel for active faults or supervisory signals. Document and report any fault. A panel with a persistent fault must be reported to the alarm company within 24 hours.

## 3. Annual Requirements
- **3.1 Fire Extinguisher Annual Service**: All extinguishers must be serviced by a licensed fire protection company annually. Retain service records on-site for 3 years.
- **3.2 Sprinkler Flow Test**: Annual sprinkler flow test required by a licensed contractor. Retain test report on-site.
- **3.3 Egress Drill**: Conduct a documented evacuation drill at each site at least once per year. Record participant count, duration, and any issues found.

## 4. Deficiency Response
Critical deficiencies (non-functioning exit sign, blocked egress, failed fire panel) require same-day correction or an approved interim measure (temporary fire watch, barrier, or alternative exit posting). Document all deficiencies and corrective actions. Submit completed inspection forms to the Regional Manager within 5 days of inspection.`,
      },
      {
        title: "Preventive Maintenance Scheduling Procedure",
        description: "Standards for scheduling, documenting, and completing preventive maintenance tasks across all sites.",
        category: "MAINTENANCE",
        assetType: null,
        version: "1.3",
        content: `## 1. Purpose
Reactive maintenance is more expensive and disruptive than preventive maintenance. This procedure establishes how PM tasks are scheduled, tracked, and documented to ensure no asset exceeds its service interval.

## 2. PM Schedule Maintenance
- **2.1 Asset Register**: All assets with PM requirements must be entered into the CMMS with make, model, serial number, location, and manufacturer-specified service intervals.
- **2.2 PM Frequency**: PM tasks must be scheduled at or before the manufacturer's recommended service interval. Extending a PM past its due date requires written approval from the Site Manager with a documented reason.
- **2.3 Advance Scheduling**: PMs must be created in the CMMS at least 14 days before the due date to allow for parts ordering and labor scheduling.

## 3. PM Completion Standards
- **3.1 Technician Requirements**: Each PM task must specify the required trade qualification. Electrical PMs require a qualified electrician. HVAC PMs require an HVAC-certified technician. General maintenance PMs may be completed by trained maintenance staff.
- **3.2 Parts Verification**: Verify that all required parts and supplies are on-hand before closing any PM work order as incomplete due to "parts unavailable." Record the parts required and ETA.
- **3.3 Documentation**: Record all measurements, readings, and findings in the PM work order. Do not close a PM with only "completed" — specific findings must be documented.

## 4. Overdue PM Escalation
- **4.1 7 Days Overdue**: Automatic CMMS notification to the Site Manager. Manager must acknowledge and provide a rescheduled date within 48 hours.
- **4.2 30 Days Overdue**: Escalate to Regional Manager. Asset may be flagged for temporary out-of-service status if overdue PM presents a safety risk.
- **4.3 Equipment with Safety Implications**: For any PM on safety-critical equipment (fire systems, lifts, pressure vessels), overdue by even 1 day requires immediate notification to the Site Manager regardless of the standard escalation schedule.`,
      },
    ],
  },
  {
    key: "car_wash",
    label: "Car Wash",
    demoCompanyName: "Clearview Car Wash",
    departments: ["Operations", "Maintenance", "Customer Service"],
    issueTypeLabels: ["Maintenance", "Operations", "Customer Complaints", "Safety", "Facilities"],
    demoLocations: [
      { name: "Main Wash — North Location", locationType: "Service Facility" },
      { name: "South Location",             locationType: "Service Facility" },
    ],
    demoVendors: [
      { name: "WashTech Equipment Services", specialty: "Wash Equipment Repair" },
      { name: "AquaPure Water Systems",      specialty: "RO / Water Treatment" },
      { name: "ChemPro Solutions",           specialty: "Chemical Supplies" },
    ],
    demoSOPs: [
      {
        title: "Bay Equipment Pre-Opening Inspection",
        description: "Daily inspection checklist for all wash bays before opening to customers.",
        category: "MAINTENANCE",
        assetType: "EQUIPMENT",
        version: "1.0",
        content: `## 1. Purpose
Ensure all wash bay equipment is safe and operational before the first customer of the day. This inspection must be completed and signed off by the opening manager before any bay is activated.

## 2. Wash Bay Inspection — Each Bay
- **2.1 Equipment function test**: Run a short wash cycle in each bay to confirm wand, high-pressure nozzle, foamer, and rinse are all operational.
- **2.2 Coin/card acceptor**: Test the coin mechanism or card reader with a test transaction. Confirm display shows correct prompts.
- **2.3 Water temperature**: Verify wash water is reaching minimum operating temperature per your chemical vendor's spec.
- **2.4 Drainage**: Confirm floor drains are clear and water is draining without pooling.
- **2.5 Visual check**: Inspect bay walls, floor, and equipment for damage, loose fittings, or hazards. Address before opening.

## 3. Vacuum Station Inspection
- **3.1 Suction test**: Test each vacuum nozzle for adequate suction. A vacuum with weak suction must be taken offline until repaired.
- **3.2 Canister check**: Empty vacuum waste containers if more than half full. A full canister reduces suction.
- **3.3 Cord and nozzle**: Inspect vacuum hose and cord for damage. Frayed cords must be removed from service.

## 4. Pay Station and Change Machine
- **4.1 Cash level**: Verify change machine has adequate coin/bill supply for the day.
- **4.2 Receipt paper**: Confirm pay station has receipt paper installed if applicable.
- **4.3 Error codes**: Clear any error codes from the previous day and verify no active faults.

## 5. Sign-Off
The opening manager must sign and date the inspection log. Any item that is out of service must be tagged and a work order submitted before the shift begins.`,
      },
      {
        title: "Customer QR Report Response Procedure",
        description: "How to respond when a customer submits a report via a bay or vacuum QR code.",
        category: "MAINTENANCE",
        assetType: null,
        version: "1.0",
        content: `## 1. Purpose
QR codes posted at bays and vacuum stations allow customers to report equipment problems instantly. This procedure ensures every customer report is acknowledged and acted on promptly.

## 2. Receiving a Customer Report
- **2.1 Notification**: A customer report creates an issue in Relay automatically. Staff will receive a notification on their device or via the dashboard.
- **2.2 Priority**: Customer-submitted reports default to MEDIUM priority. If the report indicates safety or a fully non-functional bay, escalate to HIGH immediately.
- **2.3 Response time target**: Acknowledge (assign the issue) within 15 minutes during open hours. Resolve or take the equipment offline within 1 hour.

## 3. Assessment and Action
- **3.1 Verify the report**: A staff member must physically inspect the reported bay or vacuum within 15 minutes.
- **3.2 Minor issue**: If the issue can be fixed on the spot (e.g., add soap, unclog nozzle), resolve it immediately and close the report with a note.
- **3.3 Equipment failure**: If the bay or vacuum cannot be quickly repaired, place an OUT OF SERVICE sign on the equipment and create a maintenance work order.
- **3.4 Customer follow-up**: If the customer left contact information, a manager should follow up to acknowledge their report. Customers who report issues are your best source of quality feedback.

## 4. Closing the Report
- Add a resolution note describing what was found and what was done.
- Link the report to the relevant equipment (asset) in Relay.
- If a repeat failure on the same equipment, flag for preventive maintenance review.`,
      },
    ],
  },
  {
    key: "other",
    label: "Other",
    demoCompanyName: "Demo Operations Co.",
    departments: ["Operations", "Maintenance", "Administration"],
    issueTypeLabels: ["Maintenance", "Operations", "Facilities"],
    demoLocations: [
      { name: "Main Facility",          locationType: "Service Facility" },
      { name: "Secondary Location",     locationType: "Service Facility" },
      { name: "Administrative Office",  locationType: "Office" },
    ],
    demoVendors: [
      { name: "AllFix Maintenance Services",  specialty: "General Maintenance" },
      { name: "ProTech Solutions",            specialty: "Technology" },
    ],
    demoSOPs: [
      {
        title: "Fire Safety Inspection and Emergency Response Procedure",
        description: "Monthly fire and life safety inspection checklist and evacuation response protocol.",
        category: "SAFETY",
        assetType: null,
        version: "1.5",
        content: `## 1. Purpose
This procedure ensures fire protection and life safety equipment is maintained in working order and that all personnel are prepared to respond to a fire emergency. Monthly inspections are required by fire code and OSHA standards.

## 2. Monthly Inspection Requirements
- **2.1 Fire Extinguishers**: Inspect every extinguisher monthly. Confirm pressure is in the green zone, the pull pin is intact, the inspection tag is current, and the unit shows no physical damage. Record on the Monthly Inspection Log.
- **2.2 Exit Signs and Emergency Lighting**: Test all exit signs and emergency lights by pressing the test button. Each unit must illuminate for 90 seconds minimum. Replace any that fail within 24 hours.
- **2.3 Egress Paths**: Walk all exit corridors and stairwells. Confirm no obstacles, propped fire doors, or storage blocks any egress path. Fire doors must latch completely when released.
- **2.4 Sprinkler Heads**: Visually inspect accessible sprinkler heads for damage or obstruction. Maintain an 18-inch clearance zone below all sprinkler heads.
- **2.5 Fire Alarm Panel**: Check the control panel for active faults. Report any fault to the alarm service company within 24 hours.

## 3. Emergency Response — Fire Alarm
- **3.1 Evacuate Immediately**: When the alarm sounds, begin evacuation immediately. Do not stop to investigate the source or assume it is a false alarm.
- **3.2 Call 911**: Call 911 as soon as the alarm activates.
- **3.3 Headcount at Assembly Point**: All employees meet at the designated assembly area. The manager on duty takes a headcount and confirms all personnel are accounted for.
- **3.4 Do Not Re-Enter**: No one may re-enter the building until the fire department gives the all-clear.

## 4. Documentation
Complete the Monthly Fire Safety Inspection Form for each location. Submit to the Operations Manager within 3 days of inspection. Retain completed forms for a minimum of 3 years.`,
      },
      {
        title: "HVAC Preventive Maintenance Procedure",
        description: "Scheduled inspection and service tasks for all HVAC systems to maintain efficiency and prevent breakdowns.",
        category: "MAINTENANCE",
        assetType: "EQUIPMENT",
        version: "1.4",
        content: `## 1. Purpose
Regular HVAC maintenance prevents unexpected failures, maintains air quality, extends equipment life, and reduces energy costs. This procedure defines minimum maintenance tasks at each service interval.

## 2. Monthly Tasks
- **2.1 Filter Inspection**: Inspect all air filters monthly. Replace any filter that is visibly dirty or has been in service for 30 days. Record filter size, MERV rating, and replacement date.
- **2.2 Drain Pan and Condensate Line**: Check the drain pan under the air handler for standing water or algae growth. Flush the condensate drain line with a dilute bleach solution (1 cup per gallon of water) monthly to prevent blockages.
- **2.3 Visual Inspection**: Inspect the air handler and condenser for visible damage, refrigerant line insulation condition, and any unusual sounds during operation.

## 3. Quarterly Tasks
- **3.1 Coil Cleaning**: Clean evaporator and condenser coils with an approved coil cleaner. Dirty coils reduce efficiency by 20–40% and can cause compressor failure.
- **3.2 Electrical Connections**: Inspect all electrical connections in the air handler for tightness and signs of arcing or heat. Loose connections are a fire hazard and cause equipment damage.
- **3.3 Blower and Fan**: Check blower belt condition and tension (belt-drive units). Inspect fan blades for buildup or damage. Lubricate bearings per manufacturer specification.

## 4. Annual Service
Annual service must be performed by a licensed HVAC technician and must include: refrigerant level verification, heat exchanger inspection (gas furnaces), thermostat calibration, and a written service report. Retain service reports for a minimum of 3 years.

## 5. Out-of-Range Conditions
If the system shows any of the following, take it out of service and contact a licensed HVAC technician: refrigerant ice on lines, burning smell, breaker tripping on startup, or temperature deviation greater than 5°F from thermostat setpoint after 30 minutes of runtime.`,
      },
    ],
  },
]

// Short-name aliases used by the demo/tour pages → canonical template key
const LABEL_ALIASES: Record<string, string> = {
  "Warehousing":        "warehousing",
  "Restaurant":         "restaurants",
  "Retail":             "retail",
  "Hospitality":        "hospitality",
  "Healthcare":         "healthcare",
  "Education":          "education",
  "Property Management": "property",
  "Self-Storage":       "property",
  "Car Wash":           "car_wash",
  "car-wash":           "car_wash",
  "Carwash":            "car_wash",
}

export function getTemplate(label: string): IndustryTemplate {
  const aliasKey = LABEL_ALIASES[label]
  return (
    INDUSTRY_TEMPLATES.find(t => t.label === label) ??
    (aliasKey ? INDUSTRY_TEMPLATES.find(t => t.key === aliasKey) : undefined) ??
    INDUSTRY_TEMPLATES.find(t => t.key === label.toLowerCase().trim()) ??
    INDUSTRY_TEMPLATES.find(t => t.key === "other")!
  )
}

/** The industry labels list — used in wizard + demo panel INDUSTRIES arrays */
export const INDUSTRY_LABELS = INDUSTRY_TEMPLATES.map(t => t.label)
