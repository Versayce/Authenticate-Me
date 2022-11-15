import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getSpots } from "../../store/spots";
import SpotCard from "./SpotCard";
import './Spots.css'

const SpotList = () => {
    const dispatch = useDispatch();
    const spotsObj = useSelector(state => state.spots.allSpots)
    const spots = Object.values(spotsObj);

    useEffect(() => {
        dispatch(getSpots())
    }, [dispatch])

    //console.log('spots: ', spots)
    //console.log('spotsOBJ: ', spotsObj)
    return (
        <div className="spot-container">
            <SpotCard spots={spots} />
        </div>
    )
}

export default SpotList;